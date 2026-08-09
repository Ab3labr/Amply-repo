"use client";

import { Copy } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface RoomCodeChipProps {
  code: string;
}

export function RoomCodeChip({ code }: RoomCodeChipProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    toast("Room code copied");
  };

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-border-subtle bg-surface py-[7px] pl-4 pr-2.5 max-[640px]:pl-[13px] max-[640px]:pr-2 max-[640px]:gap-2">
      <span className="font-body text-[15px] uppercase tracking-[0.14em] text-primary tabular-nums max-[640px]:text-sm max-[640px]:tracking-[0.12em]">
        {code}
      </span>
      <button
        onClick={handleCopy}
        aria-label="Copy room code"
        className="grid h-[30px] w-[30px] place-items-center rounded-full text-secondary transition-colors duration-200 hover:bg-surface-2 hover:text-primary active:translate-y-px max-[640px]:h-9 max-[640px]:w-9"
      >
        <Copy size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}