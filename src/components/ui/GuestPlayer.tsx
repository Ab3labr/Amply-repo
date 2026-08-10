"use client";

import { useState, useRef, useEffect } from "react";
import { QueueItem } from "@/lib/store";
import { getYouTubeVideoId } from "@/lib/youtube";
import { NowPlayingStage } from "@/components/ui/NowPlayingStage";
import { diag } from "@/lib/sync-diag";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const YT_STATE_NAMES: Record<number, string> = {
  [-1]: "UNSTARTED",
  [0]: "ENDED",
  [1]: "PLAYING",
  [2]: "PAUSED",
  [3]: "BUFFERING",
  [5]: "CUED",
};

function ytStateName(state: number): string {
  return YT_STATE_NAMES[state] ?? `UNKNOWN(${state})`;
}

export interface SocketCommand {
  type: "play" | "pause";
  at: number;
  seq?: number;
}

interface GuestPlayerProps {
  roomCode: string;
  queue: QueueItem[];
  currentSongIndex: number;
  isPlaying: boolean;
  serverProgress: number;
  socketCommand?: SocketCommand | null;
  hostName?: string;
}

export function GuestPlayer({ roomCode, queue, currentSongIndex, isPlaying, serverProgress, socketCommand, hostName }: GuestPlayerProps) {
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerInstanceReady, setPlayerInstanceReady] = useState(false);

  // Generation counter: a replaced player's late callbacks (onReady/onError)
  // must never re-arm the ready flag with a stale/dead instance.
  const playerGenerationRef = useRef<number>(0);
  const prevVideoIdRef = useRef<string | null>(null);
  const lastDiagPlayRef = useRef<boolean | null>(null);

  const currentSong = queue[currentSongIndex];

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setPlayerReady(true);
      };
    } else {
      setPlayerReady(true);
    }
  }, []);

  // Initialize player
  useEffect(() => {
    const initVideoId = getYouTubeVideoId(currentSong?.url || '');
    diag("PLAYER", roomCode, "player", "effect-deps-ran", {
      role: "guest",
      videoId: initVideoId || null,
      prevVideoId: prevVideoIdRef.current,
      index: currentSongIndex,
      willRecreate: !!playerRef.current,
    });

    if (!playerReady || !containerRef.current) return;

    const generation = playerGenerationRef.current + 1;
    playerGenerationRef.current = generation;

    if (playerRef.current) {
      diag("GUEST", roomCode, "player", "destroy", {});
      diag("PLAYER", roomCode, "player", "destroy", {
        role: "guest",
        videoId: prevVideoIdRef.current ?? null,
      });
      playerRef.current.destroy();
      playerRef.current = null;
      setPlayerInstanceReady(false);
    }

    // Create the player but do NOT rely on the constructor return value.
    const guestVideoId = getYouTubeVideoId(currentSong?.url || '');
    diag("GUEST", roomCode, "player", "create", { index: currentSongIndex });
    diag("PLAYER", roomCode, "player", "create", {
      role: "guest",
      videoId: guestVideoId,
      prevVideoId: prevVideoIdRef.current,
      index: currentSongIndex,
    });
    prevVideoIdRef.current = guestVideoId || null;
    new window.YT.Player(containerRef.current, {
      height: '200',
      width: '200',
      videoId: getYouTubeVideoId(currentSong?.url || ''),
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
      },
      events: {
        onReady: (event: any) => {
          if (playerGenerationRef.current !== generation) return;
          // Store canonical instance from event.target
          playerRef.current = event.target as any;
          setPlayerInstanceReady(true);
          diag("GUEST", roomCode, "player", "onReady", { index: currentSongIndex });
          diag("PLAYER", roomCode, "player", "ready", { role: "guest", videoId: guestVideoId, index: currentSongIndex });

          const readyDuration = playerRef.current?.getDuration?.();
          if (readyDuration && readyDuration > 0) {
            setDuration(readyDuration);
          }

          if (isPlaying) {
            diag("GUEST", roomCode, "PLAY", "autoplay-playVideo", { cause: "onReady" });
            diag("PLAYER", roomCode, "play", "request", { role: "guest", cause: "onReady-autoplay", videoId: guestVideoId });
            playerRef.current?.playVideo();
          }
        },
        onStateChange: (event: any) => {
          if (playerGenerationRef.current !== generation) return;
          diag("GUEST", roomCode, "yt-state", String(event.data), { index: currentSongIndex });
          {
            let liveVideoId: string | null = null;
            try {
              liveVideoId = playerRef.current?.getVideoData?.()?.video_id ?? null;
            } catch {
              liveVideoId = null;
            }
            diag("PLAYER", roomCode, "player", "state", {
              role: "guest",
              state: ytStateName(event.data),
              rawState: event.data,
              videoId: liveVideoId,
              index: currentSongIndex,
            });
          }
          if (event.data === window.YT.PlayerState.ENDED) {
            diag("GUEST", roomCode, "ENDED", "yt-ended", { index: currentSongIndex });
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            diag("GUEST", roomCode, "PLAY", "yt-playing", {});
            setTimeout(() => {
              if (playerRef.current && playerGenerationRef.current === generation) {
                diag("GUEST", roomCode, "PLAY", "currentTime-sample", {
                  value: playerRef.current.getCurrentTime?.(),
                });
              }
            }, 250);
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            diag("GUEST", roomCode, "PAUSE", "yt-paused", {});
          }
        },
        onError: (event: any) => {
          if (playerGenerationRef.current !== generation) return;
          console.debug('YouTube error:', event.data);
        },
      },
    });

    return () => {
      playerGenerationRef.current += 1;
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      diag("GUEST", roomCode, "player", "destroy-cleanup", {});
      diag("PLAYER", roomCode, "player", "cleanup", {
        role: "guest",
        videoId: prevVideoIdRef.current ?? null,
      });
      playerRef.current = null;
      setPlayerInstanceReady(false);
    };
  }, [playerReady, currentSong?.url]);

  // Control playback
  useEffect(() => {
    if (!playerRef.current || !playerInstanceReady) {
      diag("PLAYER", roomCode, isPlaying ? "play" : "pause", "ignored-not-ready", {
        role: "guest",
        cause: "poll-effect",
      });
      return;
    }

    diag("PLAYER", roomCode, isPlaying ? "play" : "pause", "request", {
      role: "guest",
      cause: "poll-effect",
    });
    if (isPlaying) {
      if (lastDiagPlayRef.current !== true) {
        diag("GUEST", roomCode, "PLAY", "effect-playVideo", { cause: "poll" });
      }
      lastDiagPlayRef.current = true;
      playerRef.current.playVideo?.();
    } else {
      if (lastDiagPlayRef.current !== false) {
        diag("GUEST", roomCode, "PAUSE", "effect-pauseVideo", { cause: "poll" });
      }
      lastDiagPlayRef.current = false;
      playerRef.current.pauseVideo?.();
    }
  }, [isPlaying, playerInstanceReady]);

  // Execute host-issued play/pause commands relayed over Socket.IO.
  // HTTP polling remains the reconciliation mechanism for state.
  useEffect(() => {
    if (!socketCommand) return;
    if (!playerRef.current || !playerInstanceReady) {
      diag("PLAYER", roomCode, socketCommand.type, "ignored-not-ready", {
        role: "guest",
        cause: "socket-command",
        seq: socketCommand.seq ?? null,
      });
      return;
    }

    diag("PLAYER", roomCode, socketCommand.type, "request", {
      role: "guest",
      cause: "socket-command",
      seq: socketCommand.seq ?? null,
    });
    if (socketCommand.type === "play") {
      diag("GUEST", roomCode, "PLAY", "playVideo()", { seq: socketCommand.seq });
      playerRef.current.playVideo?.();
    } else {
      diag("GUEST", roomCode, "PAUSE", "pauseVideo()", { seq: socketCommand.seq });
      playerRef.current.pauseVideo?.();
    }
  }, [socketCommand, playerInstanceReady]);

  // Sync progress with server
  useEffect(() => {
    if (!playerRef.current || !playerInstanceReady) return;

    if (Math.abs(played - serverProgress) > 0.05) {
      setPlayed(serverProgress);
      const duration = playerRef.current.getDuration();
      if (duration > 0) {
        diag("GUEST", roomCode, "DRIFT", "hard-seek", {
          from: played,
          to: serverProgress,
          delta: +(Math.abs(played - serverProgress) * 100).toFixed(2) + "%",
        });
        diag("PLAYER", roomCode, "seek", "apply", {
          role: "guest",
          cause: "drift-correction",
          fraction: serverProgress,
          positionSec: serverProgress * duration,
        });
        playerRef.current.seekTo(serverProgress * duration, true);
      }
    }
  }, [serverProgress, played, playerInstanceReady]);

  // Update local progress
  useEffect(() => {
    if (!playerRef.current || !playerInstanceReady || !isPlaying) return;

    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration > 0) {
          setDuration((prev) => (Math.abs(prev - duration) > 0.5 ? duration : prev));
          setPlayed(currentTime / duration);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playerInstanceReady]);

  return (
    <>
      <div ref={containerRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '200px', height: '200px' }} />
      <NowPlayingStage
        variant="guest"
        currentSong={currentSong ?? null}
        isPlaying={isPlaying}
        played={played}
        duration={duration}
        hostName={hostName}
      />
    </>
  );
}
