"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const TOAST_EVENT = "amply:toast";

export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

export function Toast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onToast = (e: Event) => {
      setMessage(String((e as CustomEvent).detail ?? ""));
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 1800);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="pointer-events-none fixed bottom-[26px] left-1/2 z-50 -translate-x-1/2 max-[640px]:bottom-[22px]">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-full bg-surface-2 border border-border-strong px-4 py-2.5 text-xs tracking-wider text-primary whitespace-nowrap"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}