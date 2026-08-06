"use client";

import { motion } from "framer-motion";

export interface Participant {
  id: string;
  name: string;
  isHost?: boolean;
  status: "Online" | "Connected";
}

interface ParticipantItemProps {
  participant: Participant;
}

export function ParticipantItem({ participant }: ParticipantItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between w-full p-4 rounded-[16px] hover:bg-surface/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-[17px] font-medium text-primary flex items-center gap-2">
          {participant.isHost && <span className="text-lg leading-none">👑</span>}
          {participant.name}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[15px] font-medium text-secondary">
        <div className={`w-2 h-2 rounded-full ${participant.status === "Online" || participant.status === "Connected" ? "bg-success" : "bg-secondary"}`} />
        {participant.status}
      </div>
    </motion.div>
  );
}
