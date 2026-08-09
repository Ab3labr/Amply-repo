"use client";

import { useState, useRef, useEffect } from "react";
import { QueueItem } from "@/lib/store";
import { getYouTubeVideoId } from "@/lib/youtube";
import { NowPlayingStage } from "@/components/ui/NowPlayingStage";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface SocketCommand {
  type: "play" | "pause";
  at: number;
}

interface GuestPlayerProps {
  queue: QueueItem[];
  currentSongIndex: number;
  isPlaying: boolean;
  serverProgress: number;
  socketCommand?: SocketCommand | null;
  hostName?: string;
}

export function GuestPlayer({ queue, currentSongIndex, isPlaying, serverProgress, socketCommand, hostName }: GuestPlayerProps) {
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerInstanceReady, setPlayerInstanceReady] = useState(false);

  // Generation counter: a replaced player's late callbacks (onReady/onError)
  // must never re-arm the ready flag with a stale/dead instance.
  const playerGenerationRef = useRef<number>(0);

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

    const generation = playerGenerationRef.current + 1;
    playerGenerationRef.current = generation;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
      setPlayerInstanceReady(false);
    }

    // Create the player but do NOT rely on the constructor return value.
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

          const readyDuration = playerRef.current?.getDuration?.();
          if (readyDuration && readyDuration > 0) {
            setDuration(readyDuration);
          }

          if (isPlaying) {
            playerRef.current?.playVideo();
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
      playerRef.current = null;
      setPlayerInstanceReady(false);
    };
  }, [playerReady, currentSong?.url]);

  // Control playback
  useEffect(() => {
    if (!playerRef.current || !playerInstanceReady) return;

    if (isPlaying) {
      playerRef.current.playVideo?.();
    } else {
      playerRef.current.pauseVideo?.();
    }
  }, [isPlaying, playerInstanceReady]);

  // Execute host-issued play/pause commands relayed over Socket.IO.
  // HTTP polling remains the reconciliation mechanism for state.
  useEffect(() => {
    if (!socketCommand || !playerRef.current || !playerInstanceReady) return;

    if (socketCommand.type === "play") {
      playerRef.current.playVideo?.();
    } else {
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
