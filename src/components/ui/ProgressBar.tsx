"use client";

import { useRef, useState } from "react";

interface ProgressBarProps {
  played: number;
  duration: number;
  onSeek?: (fraction: number) => void;
  disabled?: boolean;
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ProgressBar({ played, duration, onSeek, disabled = false }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);

  const shown = scrubbing && scrubFrac !== null ? scrubFrac : played;

  const fracFromClient = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !onSeek) return;
    e.preventDefault();
    barRef.current?.setPointerCapture(e.pointerId);
    setScrubbing(true);
    setScrubFrac(fracFromClient(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    setScrubFrac(fracFromClient(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    const frac = fracFromClient(e.clientX);
    setScrubbing(false);
    setScrubFrac(null);
    onSeek?.(frac);
  };

  const handlePointerCancel = () => {
    setScrubbing(false);
    setScrubFrac(null);
  };

  const isSeekable = !disabled && !!onSeek;
  const progressPercent = isFinite(shown) ? clamp(shown, 0, 1) * 100 : 0;

  return (
    <div className="flex items-center gap-3.5">
      <span className="min-w-[42px] text-[12px] tracking-[0.04em] text-secondary tabular-nums">
        {formatTime(shown * duration)}
      </span>

      <div
        ref={barRef}
        role="slider"
        aria-label={isSeekable ? "Seek" : "Playback progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        className={`group relative flex h-4 flex-1 items-center ${isSeekable ? "cursor-pointer" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10 transition-[height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:h-[6px]">
          <div className="absolute bottom-0 left-0 top-0 rounded-full bg-accent" style={{ width: `${progressPercent}%` }} />
        </div>
        <div
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-hi shadow-[0_0_0_4px_rgba(255,255,255,0.06)] transition-opacity duration-200 group-hover:opacity-100 ${scrubbing ? "opacity-100" : "opacity-0"}`}
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      <span className="min-w-[42px] text-right text-[12px] tracking-[0.04em] text-secondary tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  );
}