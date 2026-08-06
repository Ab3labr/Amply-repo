"use client";

import { useState, useRef, useEffect } from "react";
import { QueueItem } from "@/lib/store";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface GuestPlayerProps {
  queue: QueueItem[];
  currentSongIndex: number;
  isPlaying: boolean;
  serverProgress: number;
}

export function GuestPlayer({ queue, currentSongIndex, isPlaying, serverProgress }: GuestPlayerProps) {
  const [played, setPlayed] = useState(0);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerReady, setPlayerReady] = useState(false);

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
    if (!playerReady || !containerRef.current) return;

    if (playerRef.current) {
      playerRef.current.destroy();
    }

    playerRef.current = new window.YT.Player(containerRef.current, {
      height: '200',
      width: '200',
      videoId: currentSong?.url?.split('v=')[1]?.split('&')[0] || '',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => {
          if (isPlaying) {
            playerRef.current?.playVideo();
          }
        },
        onError: (event: any) => {
          console.debug('YouTube error:', event.data);
        },
      },
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [playerReady, currentSong?.url]);

  // Control playback
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;

    if (isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying, playerReady]);

  // Sync progress with server
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;

    if (Math.abs(played - serverProgress) > 0.05) {
      setPlayed(serverProgress);
      const duration = playerRef.current.getDuration();
      if (duration > 0) {
        playerRef.current.seekTo(serverProgress * duration, true);
      }
    }
  }, [serverProgress, played, playerReady]);

  // Update local progress
  useEffect(() => {
    if (!playerRef.current || !playerReady || !isPlaying) return;

    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration > 0) {
          setPlayed(currentTime / duration);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playerReady]);

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
}
