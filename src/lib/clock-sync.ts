"use client";

// PHASE 1 — Temporary Per-Session Clock Synchronization (NTP-style).
//
// This module estimates the SERVER's wall-clock (Date.now, epoch ms) from the
// current browser using a classic NTP-style exchange over Socket.IO:
//
//   client perf.now (t0) --emit CLOCK_SYNC--> server (t1 = receive, t2 = send)
//   <--ack({t1,t2})-- client perf.now (t3)
//
//   rtt    = t3 - t0                      (purely local, performance.now)
//   sMid   = (t1 + t2) / 2                (server frame = epoch ms)
//   cMid   = (t0 + t3) / 2                (local frame   = performance.now)
//   offset = sMid - cMid                  (added to performance.now() to
//                                          reproduce server Date.now())
//
// The offset is anchored to the local monotonic clock (performance.now()), so
// Date.now() jitter on the client never pollutes later estimates, and calls to
// getEstimatedServerTime() fold in elapsed time for free.
//
// Several samples are collected. Low-RTT samples are preferred and samples that
// look like outliers (RTT far above the median, or ack timeouts) are rejected.
// Uncertainty = max(bestRtt / 2, stdev of retained offsets).
//
// This state lives ONLY in the current page's JS module — it is never written
// to the store, never persisted, and never used to control playback yet.
//
// Later phases may import the getters (getEstimatedServerTime(), …) without
// needing the originating socket reference.

import type { Socket } from "socket.io-client";
import { diag } from "@/lib/sync-diag";

const INITIAL_SAMPLES = 6;
const MAINTENANCE_SAMPLES = 3;
const SAMPLE_INTERVAL_MS = 250;
const MAINTENANCE_INTERVAL_MS = 15_000;
const ACK_TIMEOUT_MS = 2_000;

// ── module-level (session-scoped) estimate state ───────────────────────────
let offsetMs = 0; // ms to add to performance.now() to estimate server time
let rttMs = 0; // round-trip of the accepted (best) sample
let uncertaintyMs = 0; // symmetric error bound around the offset estimate
let hasEstimate = false; // a usable estimate has been produced
let sampleNumber = 0; // last collected sample number (for diagnostics)
let bestSampleNumber = -1; // sample chosen as the estimate (for diagnostics)

let generation = 0; // invalidates in-flight bursts after stop/restart
let maintenanceTimer: ReturnType<typeof setTimeout> | null = null;
let activeRoomCode = "";
interface ClockSample {
  rtt: number;
  offset: number;
  n: number;
}
let burstSamples: ClockSample[] = [];

// ── public getters (reusable by later phases) ──────────────────────────────

/** Estimated server wall-clock (Date.now-style epoch ms) right now. */
export function getEstimatedServerTime(): number {
  return performance.now() + offsetMs;
}

/** Offset (ms) to add to performance.now() to match server Date.now(). */
export function getClockOffset(): number {
  return offsetMs;
}

/** Round-trip time (ms) of the accepted sample. */
export function getClockRtt(): number {
  return rttMs;
}

/** Symmetric uncertainty bound (ms) around the offset estimate. */
export function getClockUncertainty(): number {
  return uncertaintyMs;
}

export function hasClockEstimate(): boolean {
  return hasEstimate;
}

// ── lifecycle ──────────────────────────────────────────────────────────────

/** Start collecting clock samples over the given socket (room-scoped session). */
export function startClockSync(socket: Socket, roomCode = "") {
  const gen = ++generation;
  activeRoomCode = roomCode;
  offsetMs = 0;
  rttMs = 0;
  uncertaintyMs = 0;
  hasEstimate = false;
  sampleNumber = 0;
  bestSampleNumber = -1;
  burstSamples = [];
  if (maintenanceTimer) {
    clearTimeout(maintenanceTimer);
    maintenanceTimer = null;
  }

  void (async () => {
    await runBurst(socket, gen, INITIAL_SAMPLES);
    if (generation !== gen) return;
    scheduleMaintenance(socket, gen);
  })();
}

/** Stop sampling and drop the socket reference. */
export function stopClockSync() {
  generation += 1;
  if (maintenanceTimer) {
    clearTimeout(maintenanceTimer);
    maintenanceTimer = null;
  }
  activeRoomCode = "";
}

// ── internals ──────────────────────────────────────────────────────────────

async function runBurst(socket: Socket, gen: number, rounds: number) {
  burstSamples = [];
  for (let i = 0; i < rounds; i++) {
    if (generation !== gen) return;
    await runSample(socket, gen);
    if (generation !== gen) return;
    if (i < rounds - 1) {
      await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
    }
  }
  if (generation !== gen) return;
  finalize(gen);
}

function runSample(socket: Socket, gen: number): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let guard: ReturnType<typeof setTimeout> | null = null;
    let done = false;

    const finish = (res?: { t1: number; t2: number }) => {
      if (done) return;
      done = true;
      if (guard) clearTimeout(guard);
      if (generation !== gen) return resolve();

      const t3 = performance.now();
      const rtt = t3 - t0;
      let offset = NaN;
      if (res && typeof res.t1 === "number" && typeof res.t2 === "number") {
        const sMid = (res.t1 + res.t2) / 2;
        const cMid = (t0 + t3) / 2;
        offset = sMid - cMid;
      }

      sampleNumber += 1;
      burstSamples.push({ rtt, offset, n: sampleNumber });
      const est = Number.isFinite(offset)
        ? Math.round(performance.now() + offset)
        : null;
      diag("CLOCK", activeRoomCode, "sample", sampleNumber.toString(), {
        rttMs: Number.isFinite(rtt) ? +rtt.toFixed(2) : null,
        offsetMs: Number.isFinite(offset) ? +offset.toFixed(2) : null,
        estimatedServerTime: est,
      });
      resolve();
    };

    try {
      socket.emit(
        "CLOCK_SYNC",
        { roomCode: activeRoomCode, sample: sampleNumber + 1 },
        finish
      );
      guard = setTimeout(() => finish(undefined), ACK_TIMEOUT_MS);
    } catch {
      finish(undefined);
    }
  });
}

function finalize(gen: number) {
  if (generation !== gen) return;

  const valid = burstSamples.filter(
    (s) => Number.isFinite(s.offset) && Number.isFinite(s.rtt) && s.rtt > 0
  );

  if (valid.length === 0) {
    hasEstimate = false;
    diag("CLOCK", activeRoomCode, "estimate", "none", {
      reason: "no-valid-samples",
      samples: burstSamples.length,
    });
    return;
  }

  // Reject obvious outliers: samples whose RTT is far above the median.
  const rtts = valid.map((s) => s.rtt).sort((a, b) => a - b);
  const medianRtt = rtts[Math.floor(rtts.length / 2)];
  const threshold = Math.max(medianRtt * 1.5, 200);
  let retained = valid.filter((s) => s.rtt <= threshold);
  if (retained.length === 0) retained = valid;

  // Prefer the lowest-RTT retained sample as the authoritative estimate.
  let best = retained[0];
  retained.forEach((s) => {
    if (s.rtt < best.rtt) {
      best = s;
    }
  });

  offsetMs = best.offset;
  rttMs = best.rtt;

  const mean = retained.reduce((a, b) => a + b.offset, 0) / retained.length;
  const variance =
    retained.reduce((a, b) => a + (b.offset - mean) ** 2, 0) / retained.length;
  const stdev = Math.sqrt(variance);
  uncertaintyMs = Math.max(best.rtt / 2, stdev);
  bestSampleNumber = best.n;
  hasEstimate = true;

  diag("CLOCK", activeRoomCode, "estimate", "final", {
    samples: burstSamples.length,
    valid: valid.length,
    retained: retained.length,
    bestSample: bestSampleNumber,
    rttMs: +rttMs.toFixed(2),
    offsetMs: +offsetMs.toFixed(2),
    uncertaintyMs: +uncertaintyMs.toFixed(2),
    estimatedServerTime: Math.round(getEstimatedServerTime()),
  });
}

function scheduleMaintenance(socket: Socket, gen: number) {
  if (generation !== gen) return;
  maintenanceTimer = setTimeout(() => {
    maintenanceTimer = null;
    void (async () => {
      if (generation !== gen) return;
      await runBurst(socket, gen, MAINTENANCE_SAMPLES);
      if (generation !== gen) return;
      scheduleMaintenance(socket, gen);
    })();
  }, MAINTENANCE_INTERVAL_MS);
}