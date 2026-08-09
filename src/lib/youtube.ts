export const THUMBNAIL_QUALITIES = ["maxresdefault", "hqdefault", "mqdefault"] as const;

export function getYouTubeVideoId(url: string): string {
  if (!url) return "";

  const v = url.split("v=")[1]?.split("&")[0];
  if (v) return v;

  const youtuBeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (youtuBeMatch) return youtuBeMatch[1];

  const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  return "";
}

export function getYouTubeThumbnailUrl(url: string): string {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return "";
  return `https://img.youtube.com/vi/${videoId}/${THUMBNAIL_QUALITIES[0]}.jpg`;
}
