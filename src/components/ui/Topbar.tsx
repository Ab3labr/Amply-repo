import Link from "next/link";
import { LogOut } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { RoomCodeChip } from "@/components/ui/RoomCodeChip";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Participant } from "@/components/ui/ParticipantItem";

interface TopbarProps {
  code: string;
  members: Participant[];
  onLeave: () => void;
}

export function Topbar({ code, members, onLeave }: TopbarProps) {
  return (
    <header className="relative z-20 flex h-[68px] flex-none items-center gap-[22px] border-b border-border-subtle bg-background px-[26px] max-[900px]:gap-4 max-[640px]:h-[60px] max-[640px]:gap-3 max-[640px]:px-3.5 max-[420px]:gap-2.5 max-[420px]:px-2.5">
      <Link
        href="/"
        className="flex items-center gap-2.5 text-[25px] font-normal tracking-[-0.01em] text-primary transition-opacity hover:opacity-80 max-[900px]:text-[23px] max-[640px]:gap-2 max-[640px]:text-[21px] max-[420px]:text-[19px]"
      >
        <BrandMark className="h-4 w-4 text-secondary max-[640px]:h-4 max-[640px]:w-4" />
        Amply
      </Link>

      <RoomCodeChip code={code} />

      <div className="flex-1" />

      <div className="flex items-center gap-4 max-[900px]:gap-2.5 max-[420px]:hidden">
        <AvatarStack members={members} />
      </div>

      <button
        onClick={onLeave}
        aria-label="Leave room"
        title="Leave room"
        className="grid h-8 w-8 place-items-center rounded-full text-secondary transition-colors duration-200 hover:bg-surface-2 hover:text-primary active:translate-y-px max-[640px]:h-10 max-[640px]:w-10"
      >
        <LogOut size={16} strokeWidth={1.8} />
      </button>
    </header>
  );
}