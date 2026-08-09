"use client";

import { useState, useRef, useEffect } from "react";
import { QueueItem } from "@/lib/store";
import { getYouTubeVideoId } from "@/lib/youtube";
import { NowPlayingStage } from "@/components/ui/NowPlayingStage";
import { diag, nextSeq } from "@/lib/sync-diag";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface HostPlayerProps {
  code: string;
  queue: QueueItem[];
  currentSongIndex: number;
  isPlaying: boolean;
  onPlay?: (seq?: number) => void;
  onPause?: (seq?: number) => void;
  onSeek?: (position: number, seq?: number) => void;
}

export function HostPlayer({ code, queue, currentSongIndex, isPlaying, onPlay, onPause, onSeek }: HostPlayerProps) {
  try {
    console.log('[HostPlayer] Component render - Props:', { code, queueLength: queue.length, currentSongIndex, isPlaying });

    const [played, setPlayed] = useState(0);
    const [duration, setDuration] = useState(0);
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [playerInstanceReady, setPlayerInstanceReady] = useState(false);

    // Generation counter: every time a player is destroyed/recreated we bump it.
    // Callbacks (onReady/onStateChange) from a replaced player can fire after the
    // new player was created, so they must be ignored to avoid re-arming the
    // player with a stale/dead instance.
    const playerGenerationRef = useRef<number>(0);

    // Debouncing refs for progress sync
    const lastSyncTimeRef = useRef<number>(0);
    const lastSyncedProgressRef = useRef<number>(0);
    const lastDiagPlayRef = useRef<boolean | null>(null);

    const currentSong = queue[currentSongIndex];

    // Component mount/unmount logging
    useEffect(() => {
      console.log('[HostPlayer] Component MOUNTED');
      return () => {
        console.log('[HostPlayer] Component UNMOUNTING');
      };
    }, []);

    // Log state changes
    useEffect(() => {
      console.log('[HostPlayer] State changed:', {
        played: played.toFixed(3),
        playerReady,
        playerInstanceReady,
        isPlaying
      });
    }, [played, playerReady, playerInstanceReady, isPlaying]);

  // Load YouTube IFrame API
  useEffect(() => {
    console.log('[HostPlayer] YouTube API loading useEffect executing');
    try {
      if (!window.YT) {
        console.log('[HostPlayer] YouTube API not loaded, loading script');
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          try {
            console.log('[HostPlayer] YouTube API ready callback fired');
            setPlayerReady(true);
          } catch (error) {
            console.error('[HostPlayer] Error in YouTube API ready callback:', error);
          }
        };
      } else {
        console.log('[HostPlayer] YouTube API already loaded');
        setPlayerReady(true);
      }
    } catch (error) {
      console.error('[HostPlayer] Error in YouTube API loading useEffect:', error);
    }
  }, []);

  // Initialize player
  useEffect(() => {
    console.log('[HostPlayer] Player initialization useEffect executing', {
      playerReady,
      hasContainer: !!containerRef.current,
      songUrl: currentSong?.url,
      hasExistingPlayer: !!playerRef.current
    });

    try {
      if (!playerReady || !containerRef.current) return;

      // Bump the generation for this player creation. Any callback from a
      // previous (destroyed) instance is now stale and must not drive the player.
      const generation = playerGenerationRef.current + 1;
      playerGenerationRef.current = generation;

      if (playerRef.current) {
        console.log('[HostPlayer] Destroying existing player instance');
        diag("HOST", code, "player", "destroy", {});
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error('[HostPlayer] Error destroying player:', error);
        }
        playerRef.current = null;
        setPlayerInstanceReady(false);
      }

      const videoId = getYouTubeVideoId(currentSong?.url || '');
      console.log('[HostPlayer] Creating new YouTube player with videoId:', videoId);
      diag("HOST", code, "player", "create", { videoId, index: currentSongIndex });

      // Create the player but do not use the constructor return value as the
      // canonical instance. The YT API provides the canonical instance via
      // `onReady` as `event.target`.
      new window.YT.Player(containerRef.current, {
        height: '200',
        width: '200',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            try {
              if (playerGenerationRef.current !== generation) {
                console.log('[HostPlayer] Ignoring stale onReady from replaced player');
                return;
              }
              console.log('[HostPlayer] YouTube onReady event fired');
              diag("HOST", code, "player", "onReady", { index: currentSongIndex });
              // Store the canonical YT.Player instance from event.target
              playerRef.current = event.target as any;
              setPlayerInstanceReady(true);

              // Capture the current track duration for the progress readout
              const readyDuration = playerRef.current?.getDuration?.();
              if (readyDuration && readyDuration > 0) {
                setDuration(readyDuration);
              }

              // Recover playback position from server on mount
              console.log('[HostPlayer] Recovering playback position from server');
              fetch(`/api/rooms/${code}`)
                .then(res => res.json())
                .then(room => {
                  if (room && room.progress > 0 && playerRef.current) {
                    console.log('[HostPlayer] Seeking to server progress:', room.progress);
                    const duration = playerRef.current.getDuration();
                    if (duration > 0) {
                      playerRef.current.seekTo(room.progress * duration, true);
                      setPlayed(room.progress);
                    }
                  }
                })
                .catch(error => {
                  console.error('[HostPlayer] Error fetching room state for recovery:', error);
                });

              if (isPlaying) {
                console.log('[HostPlayer] Auto-playing video (isPlaying=true)');
                diag("HOST", code, "PLAY", "autoplay-playVideo", { cause: "onReady" });
                try {
                  playerRef.current?.playVideo();
                } catch (error) {
                  console.error('[HostPlayer] Error calling playVideo in onReady:', error);
                }
              }
            } catch (error) {
              console.error('[HostPlayer] Error in onReady callback:', error);
            }
          },
          onStateChange: (event: any) => {
            try {
              if (playerGenerationRef.current !== generation) {
                console.log('[HostPlayer] Ignoring stale onStateChange from replaced player');
                return;
              }
              console.log('[HostPlayer] YouTube onStateChange event:', event.data);
              diag("HOST", code, "yt-state", String(event.data), { index: currentSongIndex });
              if (event.data === window.YT.PlayerState.ENDED) {
                console.log('[HostPlayer] Song ended, calling handleNext');
                diag("HOST", code, "ENDED", "yt-ended", { index: currentSongIndex });
                handleNext();
              }
            } catch (error) {
              console.error('[HostPlayer] Error in onStateChange callback:', error);
            }
          },
          onError: (event: any) => {
            if (playerGenerationRef.current !== generation) return;
            console.error('[HostPlayer] YouTube onError event:', event.data);
          },
        },
      });
    } catch (error) {
      console.error('[HostPlayer] Error in player initialization useEffect:', error);
    }

    return () => {
      // Bump the generation so any callbacks still pending from this player
      // instance are invalidated before the new player is created.
      playerGenerationRef.current += 1;
      console.log('[HostPlayer] Player initialization useEffect cleanup - destroying player');
      try {
        if (playerRef.current) {
          playerRef.current.destroy();
        }
      } catch (error) {
        console.error('[HostPlayer] Error destroying player in cleanup:', error);
      }
      diag("HOST", code, "player", "destroy-cleanup", {});
      playerRef.current = null;
      setPlayerInstanceReady(false);
    };
  }, [playerReady, currentSong?.url]);

  // Control playback
  useEffect(() => {
    console.log('[HostPlayer] Playback control useEffect executing', {
      hasPlayer: !!playerRef.current,
      playerInstanceReady,
      isPlaying
    });

    try {
      if (!playerRef.current || !playerInstanceReady) return;

      if (isPlaying) {
        console.log('[HostPlayer] Calling playVideo()');
        if (lastDiagPlayRef.current !== true) {
          diag("HOST", code, "PLAY", "effect-playVideo", { cause: "poll" });
        }
        lastDiagPlayRef.current = true;
        try {
          playerRef.current.playVideo?.();
        } catch (error) {
          console.error('[HostPlayer] Error calling playVideo():', error);
        }
      } else {
        console.log('[HostPlayer] Calling pauseVideo()');
        if (lastDiagPlayRef.current !== false) {
          diag("HOST", code, "PAUSE", "effect-pauseVideo", { cause: "poll" });
        }
        lastDiagPlayRef.current = false;
        try {
          playerRef.current.pauseVideo?.();
        } catch (error) {
          console.error('[HostPlayer] Error calling pauseVideo():', error);
        }
      }
    } catch (error) {
      console.error('[HostPlayer] Error in playback control useEffect:', error);
    }
  }, [isPlaying, playerInstanceReady]);

  // Sync progress
  useEffect(() => {
    console.log('[HostPlayer] Progress sync useEffect executing', {
      hasPlayer: !!playerRef.current,
      playerInstanceReady,
      isPlaying,
      code
    });

    try {
      if (!playerRef.current || !playerInstanceReady || !isPlaying) return;

      console.log('[HostPlayer] Starting progress sync interval (1000ms)');
      const interval = setInterval(() => {
        try {
          if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
            const currentTime = playerRef.current.getCurrentTime();
            const duration = playerRef.current.getDuration();
            if (duration > 0) {
              setDuration((prev) => (Math.abs(prev - duration) > 0.5 ? duration : prev));
              const progress = currentTime / duration;
              console.log('[HostPlayer] Updating played state:', progress.toFixed(3));
              setPlayed(progress);

              const now = Date.now();
              const timeSinceLastSync = now - lastSyncTimeRef.current;
              const progressDrift = Math.abs(progress - lastSyncedProgressRef.current);

              if (timeSinceLastSync > 500 || progressDrift > 0.02) {
                lastSyncTimeRef.current = now;
                lastSyncedProgressRef.current = progress;

                console.log('[HostPlayer] Syncing progress to server:', progress.toFixed(3));
                diag("HOST", code, "progress", "post", { progress });
                fetch(`/api/rooms/${code}/player`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ progress }),
                }).catch((error) => {
                  if (!(error instanceof Error) || error.name !== 'AbortError') {
                    console.error('[HostPlayer] Progress sync error:', error);
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error('[HostPlayer] Error in progress sync interval:', error);
        }
      }, 1000);

      return () => {
        console.log('[HostPlayer] Progress sync useEffect cleanup - clearing interval');
        clearInterval(interval);
      };
    } catch (error) {
      console.error('[HostPlayer] Error in progress sync useEffect:', error);
      return () => {};
    }
  }, [isPlaying, playerInstanceReady, code]);

  const handlePlayPause = async () => {
    console.log('[HostPlayer] handlePlayPause called', { isPlaying });
    const seq = nextSeq();
    const clickAt = performance.now();
    const action = isPlaying ? "PAUSE" : "PLAY";
    diag("HOST", code, action, "click", { seq });
    try {
      // Optimistically drive the host's own player at click time so the host
      // reacts immediately instead of waiting for the next poll to deliver
      // `isPlaying`. This keeps the host aligned with guests (who react to the
      // socket relay instantly) and prevents drift-correction from yanking
      // guests backward during the old poll lag.
      if (playerRef.current && playerInstanceReady) {
        try {
          if (isPlaying) {
            playerRef.current.pauseVideo?.();
          } else {
            playerRef.current.playVideo?.();
          }
        } catch (error) {
          console.error('[HostPlayer] Error in optimistic play/pause:', error);
        }
        diag("HOST", code, action, "local-call", {
          seq,
          dyMs: +(performance.now() - clickAt).toFixed(2),
        });
      }

      if (isPlaying) {
        console.log('[HostPlayer] Calling onPause callback');
        try {
          onPause?.(seq);
        } catch (error) {
          console.error('[HostPlayer] Error in onPause callback:', error);
        }
      } else {
        console.log('[HostPlayer] Calling onPlay callback');
        try {
          onPlay?.(seq);
        } catch (error) {
          console.error('[HostPlayer] Error in onPlay callback:', error);
        }
      }

      console.log('[HostPlayer] Sending play/pause to server');
      const res = await fetch(`/api/rooms/${code}/player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isPlaying ? "pause" : "play", seq }),
      });
      diag("HOST", code, action, "api-response", { seq, status: res.status });
    } catch (error) {
      console.error('[HostPlayer] handlePlayPause error:', error);
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error('[HostPlayer] Play/pause error:', error);
      }
    }
  };

  const handleSeek = (fraction: number) => {
    // UI-only seek: drive the host's own player directly and relay the position
    // through the existing onSeek callback (Socket.IO SEEK). No new sync path.
    if (!playerRef.current || !playerInstanceReady) return;

    const seq = nextSeq();
    const seekStart = performance.now();
    diag("HOST", code, "SEEK", "click", { seq, fraction, played });
    let position = 0;
    try {
      const dur = playerRef.current.getDuration?.();
      if (!dur || dur <= 0) return;
      const clamped = Math.min(1, Math.max(0, fraction));
      position = clamped * dur;
      playerRef.current.seekTo(position, true);
      setPlayed(clamped);
      diag("HOST", code, "SEEK", "seekTo()", { seq, position, dyMs: +(performance.now() - seekStart).toFixed(2) });
    } catch (error) {
      console.error('[HostPlayer] Error in handleSeek:', error);
      return;
    }

    try {
      onSeek?.(position, seq);
    } catch (error) {
      console.error('[HostPlayer] Error calling onSeek in handleSeek:', error);
    }
  };

  const handleNext = async () => {
    console.log('[HostPlayer] handleNext called', {
      hasPlayer: !!playerRef.current,
      playerInstanceReady
    });
    const seq = nextSeq();
    const clickAt = performance.now();
    diag("HOST", code, "NEXT", "click", { seq });

    // Defensive guard: don't proceed if player is being destroyed/recreated
    if (!playerRef.current || !playerInstanceReady) {
      console.warn('[HostPlayer] handleNext called but player not ready, skipping');
      diag("HOST", code, "NEXT", "skip-not-ready", { seq });
      return;
    }

    try {
      let position = 0;
      try {
        position = playerRef.current?.getCurrentTime?.() ?? 0;
        console.log('[HostPlayer] Current position:', position);
      } catch (error) {
        console.error('[HostPlayer] Error getting current time:', error);
      }

      try {
        onSeek?.(position, seq);
      } catch (error) {
        console.error('[HostPlayer] Error in onSeek callback:', error);
      }

      console.log('[HostPlayer] Sending next action to server');
      const res = await fetch(`/api/rooms/${code}/player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "next", seq }),
      });
      diag("HOST", code, "NEXT", "api-response", {
        seq,
        status: res.status,
        dyMs: +(performance.now() - clickAt).toFixed(2),
      });
      console.log('[HostPlayer] Next action completed successfully');
    } catch (error) {
      console.error('[HostPlayer] handleNext error:', error);
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error('[HostPlayer] Next error:', error);
      }
    }
  };

  const handlePrevious = async () => {
    console.log('[HostPlayer] handlePrevious called', {
      hasPlayer: !!playerRef.current,
      playerInstanceReady
    });
    const seq = nextSeq();
    const clickAt = performance.now();
    diag("HOST", code, "PREVIOUS", "click", { seq });

    // Defensive guard: don't proceed if player is being destroyed/recreated
    if (!playerRef.current || !playerInstanceReady) {
      console.warn('[HostPlayer] handlePrevious called but player not ready, skipping');
      diag("HOST", code, "PREVIOUS", "skip-not-ready", { seq });
      return;
    }

    try {
      let position = 0;
      try {
        position = playerRef.current?.getCurrentTime?.() ?? 0;
        console.log('[HostPlayer] Current position:', position);
      } catch (error) {
        console.error('[HostPlayer] Error getting current time:', error);
      }

      try {
        onSeek?.(position, seq);
      } catch (error) {
        console.error('[HostPlayer] Error in onSeek callback:', error);
      }

      console.log('[HostPlayer] Sending previous action to server');
      const res = await fetch(`/api/rooms/${code}/player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "previous", seq }),
      });
      diag("HOST", code, "PREVIOUS", "api-response", {
        seq,
        status: res.status,
        dyMs: +(performance.now() - clickAt).toFixed(2),
      });
      console.log('[HostPlayer] Previous action completed successfully');
    } catch (error) {
      console.error('[HostPlayer] handlePrevious error:', error);
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error('[HostPlayer] Previous error:', error);
      }
    }
  };

  return (
    <>
      <div ref={containerRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '200px', height: '200px' }} />
      <NowPlayingStage
        variant="host"
        currentSong={currentSong ?? null}
        isPlaying={isPlaying}
        played={played}
        duration={duration}
        onPlayPause={handlePlayPause}
        onPrev={handlePrevious}
        onNext={handleNext}
        onSeek={handleSeek}
      />
    </>
  );
  } catch (error) {
    console.error('[HostPlayer] Error in render:', error);
    return (
      <div className="w-full p-6 bg-red-900/20 border border-red-500/50 rounded-[24px]">
        <h3 className="text-red-400 font-bold mb-2">HostPlayer Render Error</h3>
        <p className="text-red-300 text-sm">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    );
  }
}
