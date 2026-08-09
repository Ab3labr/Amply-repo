"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/Toast";

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
      const res = await fetch(`/api/rooms/${code}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      if (res.ok) {
        toast("Added to queue");
      }
      setLink("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      <input
        type="text"
        placeholder="Paste a YouTube link to add"
        aria-label="Add song to queue"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
        disabled={isLoading}
        className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-surface px-3.5 py-[11px] text-sm text-primary placeholder-secondary transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-accent focus:bg-surface-2 focus:outline-none"
      />
      <button
        onClick={handleAdd}
        disabled={!link.trim() || isLoading}
        aria-label="Add to queue"
        className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-border-subtle bg-transparent text-primary transition-[border-color,background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border-strong hover:bg-surface-2 active:translate-y-px active:scale-[0.97] disabled:cursor-default disabled:opacity-50 disabled:hover:border-border-subtle disabled:hover:bg-transparent"
      >
        <Plus size={20} strokeWidth={2} />
      </button>
    </div>
  );
}