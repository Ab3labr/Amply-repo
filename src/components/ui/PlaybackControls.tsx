"use client";

import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function PlaybackControls({ isPlaying, onPlayPause, onPrev, onNext }: PlaybackControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3.5 max-[640px]:gap-3">
      <button
        onClick={onPrev}
        aria-label="Previous track"
        className="grid h-[46px] w-[46px] place-items-center rounded-full border border-border-subtle text-primary transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-2 hover:border-border-strong active:translate-y-px active:scale-[0.97] max-[640px]:h-11 max-[640px]:w-11"
      >
        <SkipBack size={20} strokeWidth={1.8} />
      </button>

      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="grid h-[72px] w-[72px] place-items-center rounded-full bg-accent text-[oklch(14%_0.02_50)] shadow-[0_14px_30px_-12px_oklch(72%_0.11_28_/_0.45)] transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hi hover:shadow-[0_16px_34px_-12px_oklch(80%_0.09_30_/_0.5)] active:translate-y-px active:scale-[0.97] max-[640px]:h-16 max-[640px]:w-16"
      >
        {isPlaying ? (
          <Pause size={26} fill="currentColor" className="scale-110" />
        ) : (
          <Play size={26} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <button
        onClick={onNext}
        aria-label="Next track"
        className="grid h-[46px] w-[46px] place-items-center rounded-full border border-border-subtle text-primary transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-2 hover:border-border-strong active:translate-y-px active:scale-[0.97] max-[640px]:h-11 max-[640px]:w-11"
      >
        <SkipForward size={20} strokeWidth={1.8} />
      </button>
    </div>
  );
}