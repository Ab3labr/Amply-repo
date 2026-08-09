"use client";

import { useState } from "react";
import { THUMBNAIL_QUALITIES } from "@/lib/youtube";

interface TrackThumbnailProps {
  thumbnailUrl: string;
  alt: string;
  className?: string;
}

export function TrackThumbnail({ thumbnailUrl, alt, className }: TrackThumbnailProps) {
  const [src, setSrc] = useState(thumbnailUrl);

  const handleError = () => {
    setSrc((prev) => {
      const step = THUMBNAIL_QUALITIES.findIndex((quality) => prev.includes(quality));
      if (step < 0 || step >= THUMBNAIL_QUALITIES.length - 1) return prev;
      return prev.replace(THUMBNAIL_QUALITIES[step], THUMBNAIL_QUALITIES[step + 1]);
    });
  };

  if (!thumbnailUrl) return null;

  return <img src={src} alt={alt} onError={handleError} className={className} loading="lazy" />;
}
