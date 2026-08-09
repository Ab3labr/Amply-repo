"use client";

import { QueueItem } from "@/lib/store";
import { QueueInput } from "@/components/ui/QueueInput";
import { QueueRow } from "@/components/ui/QueueRow";

interface QueuePanelProps {
  code: string;
  queue: QueueItem[];
  currentSongIndex: number;
  isPlaying: boolean;
}

export function QueuePanel({ code, queue, currentSongIndex, isPlaying }: QueuePanelProps) {
  return (
    <aside className="flex min-h-0 max-h-[52vh] flex-col border-t border-border-subtle bg-background-2/50 lg:max-h-none lg:border-l lg:border-t-0 lg:border-l-border-subtle">
      <div className="flex-none border-b border-border-subtle px-[22px] pb-[18px] pt-5 max-[640px]:px-[14px]">
        <div className="mb-3.5 flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-secondary">Up next</span>
          <span className="text-xs tracking-[0.06em] text-secondary tabular-nums">
            {queue.length} {queue.length === 1 ? "track" : "tracks"}
          </span>
        </div>
        <QueueInput code={code} />
      </div>

      <div className="qp-list min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {queue.length === 0 ? (
          <p className="px-[22px] py-12 text-center text-sm text-secondary">
            No songs yet — add a YouTube link above.
          </p>
        ) : (
          queue.map((song, i) => (
            <QueueRow
              key={song.id}
              song={song}
              index={i}
              isCurrent={i === currentSongIndex}
              isPlaying={isPlaying}
            />
          ))
        )}
      </div>

      <footer className="flex-none border-t border-border-subtle px-[22px] py-4 text-[12px] leading-normal tracking-[0.01em] text-secondary">
        <span className="font-medium text-primary">Anyone in the room can add.</span> New links resolve to
        track titles on the server.
      </footer>
    </aside>
  );
}