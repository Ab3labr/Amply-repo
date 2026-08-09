"use client";

import { Participant } from "@/components/ui/ParticipantItem";

interface AvatarStackProps {
  members: Participant[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AvatarStack({ members }: AvatarStackProps) {
  const visible = members.slice(0, 3);
  const overflow = members.length - visible.length;
  const hostPresent = members.some((m) => m.isHost);

  return (
    <div className="flex items-center gap-3.5">
      {hostPresent && (
        <span className="rounded-full border border-border-subtle px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-secondary max-[640px]:hidden">
          Host
        </span>
      )}

      <div className="flex">
        {visible.map((member) => {
          const connected =
            member.status === "Online" || member.status === "Connected";
          return (
            <div
              key={member.id}
              title={member.isHost ? `${member.name} (host)` : member.name}
              className="relative -ml-2 grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-surface-2 text-[12px] font-semibold tracking-[0.02em] text-primary first:ml-0 max-[900px]:h-7 max-[900px]:w-7 max-[900px]:-ml-1.5 max-[900px]:text-[11px]"
            >
              {initials(member.name)}
              {!member.isHost && connected && (
                <span className="absolute -right-px -bottom-px h-[9px] w-[9px] rounded-full border-2 border-background bg-success max-[900px]:h-2 max-[900px]:w-2" />
              )}
            </div>
          );
        })}
        {overflow > 0 && (
          <div className="grid h-8 w-8 -ml-[2px] place-items-center rounded-full border-2 border-background bg-surface-2 text-[12px] font-semibold tracking-[0.02em] text-secondary max-[900px]:h-7 max-[900px]:w-7 max-[900px]:-ml-1.5 max-[900px]:text-[11px]">
            +{overflow}
          </div>
        )}
      </div>

      {members.length > 0 && (
        <span className="font-body text-[12px] tracking-[0.06em] text-secondary tabular-nums max-[900px]:text-[11px]">
          {members.length} in the room
        </span>
      )}
    </div>
  );
}