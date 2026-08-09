// sync-diag.js — Phase 1 instrumentation for server.js (CommonJS).
//
// Mirrors src/lib/sync-diag.ts for the custom Next + Socket.IO server.
// Server-side observations are tagged with a server wall-clock (serverTs/iso)
// because cross-machine performance.now() comparisons are invalid. The `seq`
// field (originating on the host) is what lets logs from different machines be
// joined into one event sequence.
//
// To disable: set ENABLED to false.

const ENABLED = true;

function diag(tag, roomCode, event, phase, extra) {
  if (!ENABLED) return;
  const serverTs = Date.now();
  const iso = new Date(serverTs).toISOString();
  const detail = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[SYNC:${tag}] room=${roomCode} event="${event}" phase="${phase}" serverTs=${serverTs} iso=${iso}${detail}`);
}

module.exports = { diag };