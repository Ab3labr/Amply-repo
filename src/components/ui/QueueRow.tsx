import { QueueItem } from "@/lib/store";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { Equalizer } from "@/components/ui/Equalizer";

interface QueueRowProps {
  song: QueueItem;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
}

export function QueueRow({ song, index, isCurrent, isPlaying }: QueueRowProps) {
  return (
    <div
      className={`flex items-center gap-3.5 border-b border-border-subtle px-[22px] py-[13px] transition-colors duration-200 ${
        isCurrent ? "bg-[oklch(20%_0.02_70_/_0.65)]" : "hover:bg-surface"
      }`}
    >
      <div className="relative h-[46px] w-[46px] flex-none overflow-hidden rounded-[4px] bg-surface-2">
        {song.thumbnailUrl ? (
          <TrackThumbnail
            thumbnailUrl={song.thumbnailUrl}
            alt={song.title}
            className="absolute inset-0 h-full w-full rounded-[4px] object-cover"
          />
        ) : null}
        <div className="grain" />
      </div>

      {isCurrent ? (
        <span className="flex w-[22px] flex-none items-center justify-center">
          <Equalizer active={isPlaying} />
        </span>
      ) : (
        <span className="w-[22px] flex-none text-[12px] tracking-[0.05em] text-secondary tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium tracking-[0.005em] text-primary">{song.title}</div>
        <div className="mt-px truncate text-[13px] text-secondary">Added to room</div>
      </div>
    </div>
  );
}