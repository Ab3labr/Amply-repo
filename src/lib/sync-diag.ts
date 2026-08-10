// Phase 1 instrumentation helper (browser AND Next.js API-runtime).
//
// This module exists ONLY to measure the current synchronization system. It does
// NOT change any playback/sync behavior. To disable all instrumentation set
// ENABLED to false; to remove entirely, delete this file and its imports.
//
// Conventions:
//  - Client-side elapsed time uses `performance.now()` (local ruler only).
//  - `performance.now()` values from different machines are NOT comparable.
//  - Cross-machine correlation is done via `seq` (a per-host monotonic counter
//    passed through the socket/poll event chain) plus server-side Date.now().
//  - Unstructured `Date.now()` diffs across machines are intentionally avoided.

const ENABLED = true;

let seqCounter = 0;

/** Monotonic per-client sequence id for correlating one action across machines. */
export function nextSeq(): number {
  seqCounter += 1;
  return seqCounter;
}

export type SyncTag = "HOST" | "GUEST" | "SERVER" | "POLL" | "YT" | "CLOCK" | "PLAYER";

/**
 * Emit a one-line structured diagnostic.
 * phase is intentionally a free-form label describing where in the pipeline
 * the event was observed (e.g. "click", "emit", "receive", "playVideo()").
 */
export function diag(
  tag: SyncTag,
  roomCode: string,
  event: string,
  phase: string,
  extra?: Record<string, unknown>
): void {
  if (!ENABLED) return;
  const t = performance.now();
  const detail = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[SYNC:${tag}] room=${roomCode} event="${event}" phase="${phase}" t=${t.toFixed(2)}${detail}`);
}