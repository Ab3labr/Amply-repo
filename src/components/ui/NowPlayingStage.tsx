"use client";

import { useEffect } from "react";
import { QueueItem } from "@/lib/store";
import { PlayerArt } from "@/components/ui/PlayerArt";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PlaybackControls } from "@/components/ui/PlaybackControls";

interface NowPlayingStageProps {
  currentSong: QueueItem | null;
  isPlaying: boolean;
  played: number;
  duration: number;
  variant: "host" | "guest";
  hostName?: string;
  onPlayPause?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeek?: (fraction: number) => void;
}

export function NowPlayingStage({
  currentSong,
  isPlaying,
  played,
  duration,
  variant,
  hostName,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
}: NowPlayingStageProps) {
  // Host-only global shortcuts (Space play/pause, ArrowLeft/ArrowRight seek ±5s).
  // Mirrors the OpenDesign keyboard scheme; reuses the host's existing seek/play-pause calls,
  // and is safe because the YT player element stays hidden.
  useEffect(() => {
    if (variant !== "host") return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/i.test(tag)) return;

      if (e.code === "Space") {
        e.preventDefault();
        onPlayPause?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (duration > 0 && onSeek) onSeek(Math.min(1, played + 5 / duration));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (duration > 0 && onSeek) onSeek(Math.max(0, played - 5 / duration));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant, played, duration, onPlayPause, onSeek]);

  const status = currentSong ? (isPlaying ? "Now playing" : "Paused") : "Ready when you are";

  return (
    <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 pb-6 pt-2 max-[640px]:px-4">
      <div className="stage-glow" />
      <div className="bottom-glow" aria-hidden="true" />

      <PlayerArt
        key={currentSong?.id ?? "empty"}
        thumbnailUrl={currentSong?.thumbnailUrl ?? ""}
        alt={currentSong?.title ?? "Amply"}
        isPlaying={isPlaying}
      />

      <div className="flex max-w-[560px] flex-none flex-col items-center text-center">
        <div className="eyebrow mb-3 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-secondary">
          {status}
        </div>
        <h1 className="text-[clamp(26px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.015em] text-primary font-display max-[780px]:text-[clamp(24px,3.6vw,44px)] max-[640px]:text-[clamp(26px,8vw,30px)]">
          {currentSong?.title ?? "Nothing playing yet"}
        </h1>
        {variant === "guest" && hostName && (
          <p className="mt-2 text-[15px] tracking-[0.01em] text-secondary max-[640px]:text-sm">
            {hostName}&apos;s room
          </p>
        )}
      </div>

      <div className="mt-[26px] flex w-full max-w-[520px] flex-none flex-col items-center max-[780px]:mt-[18px]">
        <div className="w-full">
          <ProgressBar
            played={played}
            duration={duration}
            onSeek={variant === "host" ? onSeek : undefined}
            disabled={variant === "guest"}
          />
        </div>

        {variant === "host" && (
          <>
            <div className="mt-[18px]">
              <PlaybackControls
                isPlaying={isPlaying}
                onPlayPause={onPlayPause}
                onPrev={onPrev}
                onNext={onNext}
              />
            </div>
            <p className="mt-6 flex-none text-[11px] tracking-[0.06em] text-secondary opacity-70 max-[640px]:mt-4 max-[640px]:text-[10px]">
              <kbd className="rounded border border-border-subtle px-1.5 py-px">Space</kbd> play/pause ·{" "}
              <kbd className="rounded border border-border-subtle px-1.5 py-px">←</kbd>
              <kbd className="rounded border border-border-subtle px-1.5 py-px">→</kbd> seek
            </p>
          </>
        )}
      </div>
    </section>
  );
}