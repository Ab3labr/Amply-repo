# Amply Backend / Frontend Implementation Notes --- Design Changes v0.2

> Purpose: Technical implementation plan for the three design changes
> agreed in `Amply_UI_UX_Design_Notes.md` v0.2 (typography, real album
> art, adaptive gradient color). Read `AI_CONTEXT.md` first for
> project structure --- this file only covers what's new.

---

## 1. Typography (Fraunces + Inter)

Low-risk, frontend-only change.

- Add Fraunces via `next/font/google` alongside the existing Inter
  import in `src/app/layout.tsx`:

```ts
import { Fraunces, Inter } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
});
```

- Add `--font-fraunces` to the CSS variable list on `<html>` /
  `<body>` next to the existing `--font-inter`.
- In `globals.css`, add a token in the `@theme` block, e.g.
  `--font-display: var(--font-fraunces);` and use that utility class
  only on the now-playing song title element (likely inside
  `HostPlayer.tsx` / `GuestPlayer.tsx` or a shared `NowPlaying`
  component if one gets extracted).
- Remove any monospace font usage (room code, "HOST" label, "UP NEXT"
  label, keyboard hints) --- these should fall back to the default
  Inter body styling. Check `RoomCode.tsx` and wherever the queue
  panel labels live for a `font-mono` class and drop it.

No backend/API changes needed for this part.

---

## 2. Real Album Art from YouTube Thumbnails

No new API integration needed --- YouTube exposes thumbnails as static
images keyed by video ID, no API key required.

### URL pattern

```
https://img.youtube.com/vi/{videoId}/maxresdefault.jpg
```

Not every video has a maxres image (lower-res/older uploads don't).
Fallback chain, in order:

```
maxresdefault.jpg  -> hqdefault.jpg (always exists) -> mqdefault.jpg
```

### Where this plugs in

- `videoId` is already being extracted somewhere in the queue-add flow
  (needed for the IFrame player itself). Reuse that same extraction
  for the thumbnail URL --- no duplicate parsing logic.
- **Store the thumbnail URL on the `QueueItem` type** in
  `src/lib/store.ts` so it persists with the rest of the track data
  and gets returned by `GET /api/rooms/:code` along with everything
  else. Add a field, e.g. `thumbnailUrl: string`, populated at the
  same time the item is added to the queue in
  `src/app/api/rooms/[code]/queue/route.ts`.
- On the frontend, render an `<img>` with an `onError` handler that
  swaps `src` down the fallback chain:

```tsx
const [src, setSrc] = useState(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);

<img
  src={src}
  onError={() => {
    if (src.includes("maxresdefault")) {
      setSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
    } else if (src.includes("hqdefault")) {
      setSrc(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
    }
  }}
/>
```

- Both the "Now Playing" square art and the queue list thumbnails
  should use the same field/logic --- one source of truth, no
  duplicated fallback code.

---

## 3. Adaptive Color Extraction

This is the part with real implementation decisions to make. Two
viable approaches:

### Approach A --- Client-side extraction (recommended to start)

- Use a small browser-side color extraction library, e.g.
  **ColorThief** or **Vibrant.js**, run against the thumbnail `<img>`
  once it loads.
- **CORS note:** `img.youtube.com` serves images with permissive CORS
  headers, so `crossOrigin="anonymous"` on the `<img>` tag should
  allow canvas-based pixel reads without a "tainted canvas" error.
  Verify this early --- if it becomes a blocker, fall back to Approach
  B.
- Extraction happens **once per track**, on the host's device (since
  the host is the source of truth for playback). Cache the resulting
  palette (e.g. `{ primary: "#...", secondary: "#..." }`) in component
  state keyed by `videoId` so switching back to a previously-played
  track doesn't recompute.
- **Propagate the palette to guests:** guests should see the same
  colors as the host, not compute their own (cheaper, and keeps the
  room visually in sync). Two options:
  - Simplest: guests also run the same client-side extraction
    independently (same input image → same deterministic output, no
    sync needed). No backend change required. Slight duplicate work
    across devices but negligible cost.
  - More consistent: host computes once and pushes the palette over
    the existing Socket.IO channel alongside `PLAY`/`PAUSE` events, or
    piggybacks on the 2s poll response. Adds a small `RoomData` field
    (`currentPalette`) in `store.ts`. Only worth doing if independent
    per-device extraction produces visibly different results in
    testing.
  - **Recommendation:** start with independent client-side extraction
    on both host and guest (no backend change). Only move to
    host-computed + pushed if you see inconsistency in practice.

### Approach B --- Server-side extraction (fallback if CORS blocks A)

- Add a small API route, e.g. `GET /api/rooms/[code]/palette`, that
  fetches the thumbnail server-side (no CORS restriction there) and
  runs extraction with a Node library (e.g. `node-vibrant`).
- Cache the result per `videoId` in `store.ts` (or an in-memory Map
  alongside `roomsStore`) so repeat plays of the same track don't
  re-run extraction.
- Frontend fetches this once when a new track becomes current.

### Applying the palette

Once you have `{ primary, secondary }` (or similar) for the current
track, apply as CSS custom properties scoped to the player component,
e.g.:

```css
.now-playing {
  --accent-primary: <extracted color>;
  --accent-secondary: <extracted color>;
}
```

Then:
- Gradient wave blobs use `--accent-primary` / `--accent-secondary`
  at low opacity with heavy blur.
- Vinyl rim glow: a `box-shadow` or pseudo-element ring using
  `--accent-primary` at low opacity.
- Play button fill: `--accent-primary`.
- Progress bar fill: `--accent-primary`.

Crossfade on track change by transitioning the CSS custom property
values (or cross-fading two absolutely-positioned gradient layers) over
~1.5s, per the design doc.

---

## Summary of concrete file touches

| File | Change |
|---|---|
| `src/app/layout.tsx` | Add Fraunces font import + CSS variable |
| `src/app/globals.css` | Add `--font-display` token, adaptive-color CSS custom properties |
| `src/lib/store.ts` | Add `thumbnailUrl` (and optionally `currentPalette`) to relevant types |
| `src/app/api/rooms/[code]/queue/route.ts` | Populate `thumbnailUrl` when a track is added |
| `src/components/ui/HostPlayer.tsx` / `GuestPlayer.tsx` | Render real thumbnail with fallback chain; run/receive color extraction; apply CSS custom properties |
| Queue list component (wherever "UP NEXT" renders) | Use `thumbnailUrl` instead of placeholder color blocks; drop mono font classes |
| `RoomCode.tsx` / queue labels | Remove monospace font usage |

No changes needed to `AI_CONTEXT.md`'s core architecture (state store,
polling model, Socket.IO usage) --- this is additive, not structural.
