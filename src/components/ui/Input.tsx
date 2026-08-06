"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full bg-surface border border-border-subtle rounded-[18px] px-6 py-4 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] ${className}`}
      {...props}
    />
  );
}
