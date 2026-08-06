"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipForward, SkipBack } from "lucide-react";
import { QueueItem } from "@/lib/store";

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
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (position: number) => void;
}

export function HostPlayer({ code, queue, currentSongIndex, isPlaying, onPlay, onPause, onSeek }: HostPlayerProps) {
  try {
    console.log('[HostPlayer] Component render - Props:', { code, queueLength: queue.length, currentSongIndex, isPlaying });

    const [played, setPlayed] = useState(0);
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [playerInstanceReady, setPlayerInstanceReady] = useState(false);

    // Debouncing refs for progress sync
    const lastSyncTimeRef = useRef<number>(0);
    const lastSyncedProgressRef = useRef<number>(0);

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

      if (playerRef.current) {
        console.log('[HostPlayer] Destroying existing player instance');
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error('[HostPlayer] Error destroying player:', error);
        }
        setPlayerInstanceReady(false);
      }

      const videoId = currentSong?.url?.split('v=')[1]?.split('&')[0] || '';
      console.log('[HostPlayer] Creating new YouTube player with videoId:', videoId);

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
              console.log('[HostPlayer] YouTube onReady event fired');
              // Store the canonical YT.Player instance from event.target
              playerRef.current = event.target as any;
              setPlayerInstanceReady(true);

              if (isPlaying) {
                console.log('[HostPlayer] Auto-playing video (isPlaying=true)');
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
              console.log('[HostPlayer] YouTube onStateChange event:', event.data);
              if (event.data === window.YT.PlayerState.ENDED) {
                console.log('[HostPlayer] Song ended, calling handleNext');
                handleNext();
              }
            } catch (error) {
              console.error('[HostPlayer] Error in onStateChange callback:', error);
            }
          },
          onError: (event: any) => {
            console.error('[HostPlayer] YouTube onError event:', event.data);
          },
        },
      });
    } catch (error) {
      console.error('[HostPlayer] Error in player initialization useEffect:', error);
    }

    return () => {
      console.log('[HostPlayer] Player initialization useEffect cleanup - destroying player');
      try {
        if (playerRef.current) {
          playerRef.current.destroy();
        }
      } catch (error) {
        console.error('[HostPlayer] Error destroying player in cleanup:', error);
      }
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
        try {
          playerRef.current.playVideo?.();
        } catch (error) {
          console.error('[HostPlayer] Error calling playVideo():', error);
        }
      } else {
        console.log('[HostPlayer] Calling pauseVideo()');
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
    try {
      if (isPlaying) {
        console.log('[HostPlayer] Calling onPause callback');
        try {
          onPause?.();
        } catch (error) {
          console.error('[HostPlayer] Error in onPause callback:', error);
        }
      } else {
        console.log('[HostPlayer] Calling onPlay callback');
        try {
          onPlay?.();
        } catch (error) {
          console.error('[HostPlayer] Error in onPlay callback:', error);
        }
      }

      console.log('[HostPlayer] Sending play/pause to server');
      await fetch(`/api/rooms/${code}/player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isPlaying ? "pause" : "play" }),
      });
    } catch (error) {
      console.error('[HostPlayer] handlePlayPause error:', error);
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error('[HostPlayer] Play/pause error:', error);
      }
    }
  };

  const handleNext = async () => {
    console.log('[HostPlayer] handleNext called', {
      hasPlayer: !!playerRef.current,
      playerInstanceReady
    });

    // Defensive guard: don't proceed if player is being destroyed/recreated
    if (!playerRef.current || !playerInstanceReady) {
      console.warn('[HostPlayer] handleNext called but player not ready, skipping');
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
        onSeek?.(position);
      } catch (error) {
        console.error('[HostPlayer] Error in onSeek callback:', error);
      }

      console.log('[HostPlayer] Sending next action to server');
      await fetch(`/api/rooms/${code}/player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "next" }),
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

    // Defensive guard: don't proceed if player is being destroyed/recreated
    if (!playerRef.current || !playerInstanceReady) {
      console.warn('[HostPlayer] handlePrevious called but player not ready, skipping');
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
        onSeek?.(position);
      } catch (error) {
        console.error('[HostPlayer] Error in onSeek callback:', error);
      }

      console.log('[HostPlayer] Sending previous action to server');
      await fetch(`/api/rooms/${code}/player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "previous" }),
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
    <div className="w-full flex flex-col items-center bg-surface p-6 rounded-[24px] border border-border-subtle shadow-lg mt-6">
      <div ref={containerRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '200px', height: '200px' }} />

      {currentSong ? (
        <>
          <h3 className="text-lg font-bold text-primary text-center mb-1 line-clamp-1">{currentSong.title}</h3>
          <p className="text-sm text-secondary mb-4">Now Playing</p>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-border-subtle rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-accent transition-all duration-300 ease-linear"
              style={{ width: `${played * 100}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6 mb-6">
            <button onClick={handlePrevious} className="text-secondary hover:text-primary transition-colors">
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button
              onClick={handlePlayPause}
              className="w-14 h-14 flex items-center justify-center bg-primary text-background rounded-full hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-secondary hover:text-primary transition-colors">
              <SkipForward size={24} fill="currentColor" />
            </button>
          </div>

          {/* Queue List */}
          {queue.length > 1 && (
            <div className="w-full mt-4 pt-4 border-t border-border-subtle">
              <h4 className="text-sm font-semibold text-secondary mb-3">Up Next</h4>
              <div className="space-y-2">
                {queue.slice(currentSongIndex + 1).map((song, index) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-background/50 hover:bg-background/70 transition-colors"
                  >
                    <span className="text-xs text-secondary w-5">{index + 1}</span>
                    <span className="text-sm text-primary flex-1 truncate">{song.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-secondary text-center">No song in queue</p>
      )}
    </div>
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
