"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";
import { Music2 } from "lucide-react";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";

interface PlayerArtProps {
  thumbnailUrl: string;
  alt: string;
  isPlaying: boolean;
}

const BASE_RX = 6;
const BASE_RY = -14;

export function PlayerArt({ thumbnailUrl, alt, isPlaying }: PlayerArtProps) {
  const sceneRef = useRef<HTMLDivElement>(null);

  const rx = useMotionValue(BASE_RX);
  const ry = useMotionValue(BASE_RY);
  const springX = useSpring(rx, { stiffness: 90, damping: 18, mass: 0.4 });
  const springY = useSpring(ry, { stiffness: 90, damping: 18, mass: 0.4 });
  const cardTransform = useMotionTemplate`rotateX(${springX}deg) rotateY(${springY}deg)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    ry.set(BASE_RY + nx * 9);
    rx.set(BASE_RX - ny * 7);
  };

  const handlePointerLeave = () => {
    rx.set(BASE_RX);
    ry.set(BASE_RY);
  };

  return (
    <div
      ref={sceneRef}
      className="tilt-scene"
      data-paused={!isPlaying}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="vinyl" aria-hidden="true">
        <span className="vinyl-label" />
      </div>

      <motion.div
        className="absolute inset-0 grid place-items-center [transform-style:preserve-3d] will-change-transform"
        style={{ transform: cardTransform }}
      >
        <div
          className="relative w-[62%] aspect-square overflow-hidden rounded-[3px] bg-surface-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_50px_-20px_rgba(0,0,0,0.75)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:[transform:translateZ(14px)]"
        >
          {thumbnailUrl ? (
            <TrackThumbnail
              thumbnailUrl={thumbnailUrl}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-2 to-background-2 text-secondary">
              <Music2 size={44} strokeWidth={1.2} />
            </div>
          )}
          <div className="grain" />
        </div>
      </motion.div>
    </div>
  );
}