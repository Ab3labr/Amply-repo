"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface QueueInputProps {
  code: string;
}

export function QueueInput({ code }: QueueInputProps) {
  const [link, setLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    if (!link) return;
    setIsLoading(true);
    try {
      await fetch(`/api/rooms/${code}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      setLink("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full relative flex items-center mt-4">
      <input
        type="text"
        placeholder="Add a YouTube link to the queue"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        disabled={isLoading}
        className="w-full bg-surface border border-border-subtle rounded-[18px] pl-6 pr-14 py-4 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
      />
      <button
        onClick={handleAdd}
        disabled={!link || isLoading}
        className="absolute right-3 p-2 text-secondary hover:text-primary transition-colors disabled:opacity-50"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
