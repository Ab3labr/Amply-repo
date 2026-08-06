"use client";

/**
 * /experiment/host — HOST PAGE
 *
 * Role: Sends the YouTube URL, then participates as a synchronized player.
 * The host's player is NOT the source of truth for timing — the server is.
 * Both host and guests receive the same PLAY_AT command and start simultaneously.
 *
 * Logs emitted:
 *   [HOST] socket connected
 *   [HOST] LOAD_VIDEO sent        — when host submits URL
 *   [HOST] LOAD_VIDEO received    — when server broadcasts back
 *   [HOST] YT.Player created
 *   [HOST] onReady fired          — YouTube player is ready
 *   [HOST] cueVideoById called
 *   [HOST] onStateChange CUED     — video is preloaded, sends CLIENT_READY
 *   [HOST] CLIENT_READY sent      — t=<timestamp>
 *   [HOST] PLAY_AT received       — t=<server_ts>, play in <ms>ms
 *   [HOST] playVideo() called     — at the scheduled moment
 *   [HOST] DRIFT measured         — <ms>ms after playVideo, sample getCurrentTime
 */

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    // Handle youtu.be short links
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    // Handle youtube.com/watch?v=
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function ts() {
  return Date.now();
}

export default function HostExperiment() {
  const socketRef = useRef<Socket | null>(null);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(null);
  const playAtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [url, setUrl] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);

  function addLog(msg: string) {
    const line = `${new Date().toISOString().slice(11, 23)}  ${msg}`;
    console.log(`[HOST-PAGE] ${line}`);
    setLogs(prev => [line, ...prev].slice(0, 120));
  }

  // ── Bootstrap Socket.IO ──────────────────────────────────────────────────
  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      addLog(`✅ Socket connected  id=${socket.id}`);
      setConnected(true);
      socket.emit("IDENTIFY", { role: "host" });
    });

    socket.on("disconnect", () => {
      addLog("❌ Socket disconnected");
      setConnected(false);
    });

    // Server broadcasts server-side experiment logs to all clients
    socket.on("LOG", (msg: string) => {
      addLog(`📡 ${msg}`);
    });

    // ── LOAD_VIDEO broadcast ─────────────────────────────────────────────
    // Server echoes this to everyone (including host) to ensure host also preloads
    socket.on("LOAD_VIDEO", ({ url: receivedUrl, serverReceivedAt }: { url: string; serverReceivedAt: number }) => {
      const now = ts();
      const networkLatency = now - serverReceivedAt;
      addLog(`📥 LOAD_VIDEO received  url=${receivedUrl}  latency=${networkLatency}ms`);

      const videoId = extractVideoId(receivedUrl);
      if (!videoId) {
        addLog(`⚠️ Could not extract video ID from URL`);
        return;
      }

      if (playerReadyRef.current && playerRef.current) {
        addLog(`▶️ cueVideoById(${videoId})`);
        playerRef.current.cueVideoById(videoId, 0);
      } else {
        addLog(`⏳ Player not ready yet — queuing videoId=${videoId}`);
        pendingVideoIdRef.current = videoId;
      }
    });

    // ── PLAY_AT ──────────────────────────────────────────────────────────
    socket.on("PLAY_AT", ({ playAt }: { playAt: number }) => {
      const now = ts();
      const delay = playAt - now;
      addLog(`🎯 PLAY_AT received  playAt=${playAt}  now=${now}  delay=${delay}ms`);

      if (playAtTimerRef.current) clearTimeout(playAtTimerRef.current);

      if (delay < 0) {
        addLog(`⚠️ PLAY_AT is in the past by ${-delay}ms — playing immediately`);
        triggerPlay(playAt);
      } else {
        playAtTimerRef.current = setTimeout(() => triggerPlay(playAt), delay);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function triggerPlay(scheduledAt: number) {
    const actualStart = ts();
    const drift = actualStart - scheduledAt;
    addLog(`▶️ playVideo() called  scheduledAt=${scheduledAt}  actualStart=${actualStart}  callDrift=${drift}ms`);

    if (!playerRef.current) {
      addLog("⚠️ Player not available at play time");
      return;
    }

    playerRef.current.playVideo();

    // Sample getCurrentTime() 200ms after play to measure actual playback position
    setTimeout(() => {
      const ytTime = playerRef.current?.getCurrentTime() ?? -1;
      const reportDrift = actualStart - scheduledAt;
      addLog(`📊 DRIFT REPORT  callDrift=${reportDrift}ms  ytCurrentTime=${ytTime.toFixed(3)}s`);
      socketRef.current?.emit("DRIFT_REPORT", {
        role: "host",
        scheduledAt,
        actualStartAt: actualStart,
        drift: reportDrift,
        ytCurrentTime: ytTime,
      });
    }, 200);
  }

  // ── Bootstrap YouTube IFrame API ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initPlayer = () => {
      addLog("🎬 YT.Player creating...");
      const player = new window.YT.Player("yt-host", {
        width: "1",
        height: "1",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            addLog(`✅ onReady fired  t=${ts()}`);
            event.target.setVolume(100);
            event.target.unMute();
            playerReadyRef.current = true;
            playerRef.current = event.target;

            // If LOAD_VIDEO arrived before player was ready, cue now
            if (pendingVideoIdRef.current) {
              addLog(`▶️ Cueing pending videoId=${pendingVideoIdRef.current}`);
              event.target.cueVideoById(pendingVideoIdRef.current, 0);
              pendingVideoIdRef.current = null;
            }
          },
          onStateChange: (event: any) => {
            const stateNameMap: Record<number, string> = {
              [-1]: "UNSTARTED",
              [0]: "ENDED",
              [1]: "PLAYING",
              [2]: "PAUSED",
              [3]: "BUFFERING",
              [5]: "CUED",
            };
            const stateName = stateNameMap[event.data] ?? `UNKNOWN(${event.data})`;

            addLog(`🔄 onStateChange → ${stateName}  t=${ts()}`);

            if (event.data === 5) {
              // CUED = video is preloaded and ready to play instantly
              addLog(`📤 CLIENT_READY sent  t=${ts()}`);
              socketRef.current?.emit("CLIENT_READY", { readyAt: ts() });
            }
          },
          onError: (event: any) => {
            addLog(`❌ YT Player error code=${event.data}`);
          },
        },
      });
      playerRef.current = player;
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.getElementById("yt-iframe-api")) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
        addLog("📜 YouTube IFrame API script injected");
      }
    }
  }, []);

  function handleLoad() {
    if (!url.trim()) return;
    addLog(`📤 LOAD_VIDEO sent  url=${url.trim()}  t=${ts()}`);
    socketRef.current?.emit("LOAD_VIDEO", { url: url.trim() });
  }

  return (
    <div style={{ fontFamily: "monospace", background: "#0a0a0a", color: "#e2e2e2", minHeight: "100vh", padding: "24px" }}>
      {/* Hidden YT player div */}
      <div id="yt-host" style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }} />

      <h1 style={{ color: "#a78bfa", marginBottom: 4 }}>🎙 Amply Sync Experiment — HOST</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>
        Status: <span style={{ color: connected ? "#22c55e" : "#ef4444" }}>{connected ? `Connected (${socketRef.current?.id?.slice(0, 6)})` : "Disconnected"}</span>
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLoad()}
          placeholder="Paste a YouTube URL and press Enter or Load"
          style={{
            flex: 1,
            background: "#141414",
            border: "1px solid #2a2a2a",
            color: "#e2e2e2",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
          }}
        />
        <button
          onClick={handleLoad}
          style={{
            background: "#6d5df6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Load
        </button>
      </div>

      <div>
        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>EVENT LOG (newest first):</p>
        <div style={{
          background: "#111",
          border: "1px solid #1e1e1e",
          borderRadius: 8,
          padding: 16,
          height: 500,
          overflowY: "auto",
          fontSize: 12,
          lineHeight: "1.7",
        }}>
          {logs.length === 0 && <span style={{ color: "#555" }}>Waiting for events...</span>}
          {logs.map((l, i) => {
            const color = l.includes("❌") ? "#ef4444"
              : l.includes("✅") ? "#22c55e"
              : l.includes("📊") || l.includes("DRIFT") ? "#f59e0b"
              : l.includes("🎯") || l.includes("PLAY_AT") ? "#a78bfa"
              : l.includes("▶️") ? "#34d399"
              : "#e2e2e2";
            return <div key={i} style={{ color, borderBottom: "1px solid #1a1a1a", paddingBottom: 2 }}>{l}</div>;
          })}
        </div>
      </div>

      <p style={{ color: "#374151", fontSize: 11, marginTop: 16 }}>
        Open <strong style={{ color: "#6b7280" }}>localhost:3000/experiment/client</strong> in another tab/browser simultaneously.
      </p>
    </div>
  );
}
