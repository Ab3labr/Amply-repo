"use client";

import { motion } from "framer-motion";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({ children, variant = "primary", className = "", ...props }: ButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center px-6 py-4 rounded-[20px] text-[17px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent";
  
  const variants = {
    primary: "bg-accent text-white hover:bg-[#7e70f7] shadow-[0_4px_14px_0_rgba(109,93,246,0.39)]",
    secondary: "bg-transparent text-primary border border-border-subtle hover:bg-surface",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
