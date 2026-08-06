"use client";

import { ParticipantItem, Participant } from "./ParticipantItem";
import { motion } from "framer-motion";

interface ParticipantListProps {
  participants: Participant[];
}

export function ParticipantList({ participants }: ParticipantListProps) {
  return (
    <div className="w-full space-y-1">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.08,
            },
          },
        }}
        className="flex flex-col"
      >
        {participants.map((p) => (
          <ParticipantItem key={p.id} participant={p} />
        ))}
      </motion.div>
    </div>
  );
}
