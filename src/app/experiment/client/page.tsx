"use client";

/**
 * /experiment/client — GUEST/CLIENT PAGE
 *
 * Role: Passive receiver. Preloads the video when told, reports ready,
 * then starts playback at the server-dictated timestamp.
 *
 * Logs emitted:
 *   [CLIENT] socket connected
 *   [CLIENT] LOAD_VIDEO received   — url + network latency
 *   [CLIENT] YT.Player created
 *   [CLIENT] onReady fired
 *   [CLIENT] cueVideoById called
 *   [CLIENT] onStateChange CUED    — preload complete, sends CLIENT_READY
 *   [CLIENT] CLIENT_READY sent     — t=<timestamp>
 *   [CLIENT] PLAY_AT received      — t=<server_ts>, play in <ms>ms
 *   [CLIENT] playVideo() called    — at scheduled moment
 *   [CLIENT] DRIFT measured        — <ms> drift + ytCurrentTime
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
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function ts() {
  return Date.now();
}

export default function ClientExperiment() {
  const socketRef = useRef<Socket | null>(null);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(null);
  const playAtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);

  function addLog(msg: string) {
    const line = `${new Date().toISOString().slice(11, 23)}  ${msg}`;
    console.log(`[CLIENT-PAGE] ${line}`);
    setLogs(prev => [line, ...prev].slice(0, 120));
  }

  // ── Bootstrap Socket.IO ──────────────────────────────────────────────────
  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      addLog(`✅ Socket connected  id=${socket.id}`);
      setConnected(true);
      socket.emit("IDENTIFY", { role: "guest" });
    });

    socket.on("disconnect", () => {
      addLog("❌ Socket disconnected");
      setConnected(false);
    });

    // Server-side log rebroadcast
    socket.on("LOG", (msg: string) => {
      addLog(`📡 ${msg}`);
    });

    // ── LOAD_VIDEO ────────────────────────────────────────────────────────
    socket.on("LOAD_VIDEO", ({ url, serverReceivedAt }: { url: string; serverReceivedAt: number }) => {
      const now = ts();
      const networkLatency = now - serverReceivedAt;
      addLog(`📥 LOAD_VIDEO received  url=${url}  networkLatency=${networkLatency}ms`);
      setNowPlaying(url);

      const videoId = extractVideoId(url);
      if (!videoId) {
        addLog(`⚠️ Could not extract video ID`);
        return;
      }

      if (playerReadyRef.current && playerRef.current) {
        addLog(`▶️ cueVideoById(${videoId})  t=${now}`);
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

    // Sample 200ms after play
    setTimeout(() => {
      const ytTime = playerRef.current?.getCurrentTime() ?? -1;
      const reportDrift = actualStart - scheduledAt;
      addLog(`📊 DRIFT REPORT  callDrift=${reportDrift}ms  ytCurrentTime=${ytTime.toFixed(3)}s`);
      socketRef.current?.emit("DRIFT_REPORT", {
        role: "guest",
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
      const player = new window.YT.Player("yt-client", {
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
              // CUED — preloaded, ready for instant play
              const readyAt = ts();
              addLog(`📤 CLIENT_READY sent  t=${readyAt}`);
              socketRef.current?.emit("CLIENT_READY", { readyAt });
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

  return (
    <div style={{ fontFamily: "monospace", background: "#0a0a0a", color: "#e2e2e2", minHeight: "100vh", padding: "24px" }}>
      {/* Hidden YT player div */}
      <div id="yt-client" style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }} />

      <h1 style={{ color: "#34d399", marginBottom: 4 }}>🎧 Amply Sync Experiment — CLIENT</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>
        Status: <span style={{ color: connected ? "#22c55e" : "#ef4444" }}>{connected ? `Connected (${socketRef.current?.id?.slice(0, 6)})` : "Disconnected"}</span>
      </p>
      {nowPlaying && (
        <p style={{ color: "#a78bfa", fontSize: 12, marginBottom: 24 }}>
          🎵 Preloading: {nowPlaying}
        </p>
      )}
      {!nowPlaying && (
        <p style={{ color: "#374151", fontSize: 12, marginBottom: 24 }}>
          Waiting for host to load a video...
        </p>
      )}

      <div>
        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>EVENT LOG (newest first):</p>
        <div style={{
          background: "#111",
          border: "1px solid #1e1e1e",
          borderRadius: 8,
          padding: 16,
          height: 560,
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
    </div>
  );
}
