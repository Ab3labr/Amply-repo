// PHASE 1 smoke test — validates the CLOCK_SYNC server handler and the same
// NTP-style client algorithm a browser uses, from two simulated roles.
// Run after `npm run dev` is up:  node tmp/clock-sync-smoke.js <port?>
const { io } = require("socket.io-client");

const port = process.argv[2] || "3000";
const url = `http://localhost:${port}`;
const ROUNDS = 6;
const WAIT_MS = 250;

function runRole(role, roomCode) {
  return new Promise((resolve) => {
    const socket = io(url, { path: "/socket.io", transports: ["websocket"] });
    const samples = [];

    socket.on("connect", () => {
      socket.emit("JOIN_ROOM", { roomCode, role });
      console.log(`\n[${role.toUpperCase()}] connected id=${socket.id} room=${roomCode}`);

      const next = (i) => {
        if (i >= ROUNDS) {
          finalize();
          return;
        }
        const t0 = Date.now();
        socket.emit("CLOCK_SYNC", { roomCode, sample: i + 1 }, (res) => {
          const t3 = Date.now();
          const rtt = t3 - t0;
          const sMid = (res.t1 + res.t2) / 2;
          const cMid = (t0 + t3) / 2;
          const offset = sMid - cMid;
          samples.push({ rtt, offset });
          console.log(
            `[${role.toUpperCase()}] sample=${i + 1} rtt=${rtt.toFixed(2)}ms offset=${offset.toFixed(2)}ms t3=${t3}`
          );
          setTimeout(() => next(i + 1), WAIT_MS);
        });
      };
      next(0);
    });

    function finalize() {
      const valid = samples.filter((s) => Number.isFinite(s.rtt) && s.rtt > 0);
      const best = valid.reduce((m, s) => (s.rtt < m.rtt ? s : m), valid[0]);
      const uncertainty = best.rtt / 2;
      console.log(
        `\n[${role.toUpperCase()}] RESULT best rtt=${best.rtt.toFixed(2)}ms offset=${best.offset.toFixed(2)}ms uncertainty=+/-${uncertainty.toFixed(2)}ms`
      );
      socket.disconnect();
      resolve({ role, best, samples: valid.length });
    }

    socket.on("disconnect", () => {});
    setTimeout(() => {
      if (samples.length < ROUNDS) {
        console.log(`[${role.toUpperCase()}] timeout — aborting`);
        socket.disconnect();
        resolve({ role, best: { rtt: NaN, offset: NaN }, samples: samples.length });
      }
    }, 15000);
  });
}

async function main() {
  const [host, guest] = await Promise.all([
    runRole("host", "CLOCK1"),
    runRole("guest", "CLOCK1"),
  ]);
  const hostNow = Date.now();
  console.log(
    `\nSmoke: server local epoch=${hostNow}; estimated host offset=${host.best.offset.toFixed(2)}ms, guest offset=${guest.best.offset.toFixed(2)}ms`
  );
  process.exit(0);
}

main();