"use client";

import { motion } from "framer-motion";
import { Copy } from "lucide-react";

interface RoomCodeProps {
  code: string;
}

export function RoomCode({ code }: RoomCodeProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-6 bg-surface px-8 py-5 rounded-[24px] border border-border-subtle shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
      >
        <span className="text-[40px] leading-none font-bold tracking-[0.2em] text-primary ml-2">{code}</span>
        <button 
          onClick={handleCopy}
          className="text-secondary hover:text-primary transition-colors p-3 rounded-full hover:bg-border-subtle"
        >
          <Copy size={24} />
        </button>
      </motion.div>
      <span className="text-secondary text-[15px]">Waiting for people to join...</span>
    </div>
  );
}
