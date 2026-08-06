# Amply — AI Context & Project Memory

> **Last updated:** 2026-08-05  
> **Changelog:** Replaced react-player with direct YouTube IFrame API to fix AbortError and audio playback issues. Added queue list display showing upcoming songs. Added keyboard navigation (Enter to confirm, Esc to back/cancel). Added progress sync debouncing (500ms or 2% drift), room expiry (24h TTL with cleanup).
> **Purpose:** Persistent memory for any AI assistant or engineer picking up this project with zero prior context. Read this fully before touching a single line of code.

---

## 1. What Is Amply?

Amply is a **collaborative listening room** web app. The core idea: one person (the "host") opens a room and shares a short room code; everyone else joins with that code. All connected devices play the same YouTube audio in sync. Think of it like a shared Spotify session — but for any YouTube link, no accounts required, and joinable from any browser.

**Tagline:** *"One room. Every device. Perfectly together."*

The product is intentionally frictionless:
- No login, no accounts, no OAuth.
- A host enters their name → gets a 6-character room code.
- Guests enter their name + the code → they're in.
- Anyone in the room can add YouTube links to a shared queue.
- The host controls playback (play/pause/next/previous).
- Guests hear the audio synced to the host's position.

---

## 2. Tech Stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Framework | **Next.js** | 16.3.0 | App Router, API routes, SSR all in one repo |
| Language | **TypeScript** | ^5 | Strict mode enabled |
| UI | **React** | 19.2.8 | Latest, used with Next.js App Router |
| Styling | **Tailwind CSS v4** | ^4 | Using the new `@theme` CSS variable approach, NOT `tailwind.config.js` |
| Animations | **Framer Motion** | ^12 | Micro-animations, page transitions |
| Icons | **lucide-react** | ^1.28 | Icon library |
| Media player | **YouTube IFrame API** | Official | Direct YouTube API for stable audio playback without AbortError |
| Font | **Inter** (Google Fonts) | via `next/font` | Loaded via CSS variable `--font-inter` |

> ⚠️ **Critical:** This project uses **Next.js 16** (not 13/14/15). Params in dynamic routes are now **Promises** — you must `use(params)` or `await params` before accessing `.code`. This is a breaking change from Next 13/14. Always read `node_modules/next/dist/docs/` for the exact API if unsure.

---

## 3. Project Architecture

### 3.1 Folder Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout — font, metadata, global CSS
│   ├── page.tsx                  # Landing page (/)
│   ├── globals.css               # Tailwind import + @theme design tokens
│   │
│   ├── host-setup/
│   │   └── page.tsx              # (/host-setup) — Host enters name, creates room
│   │
│   ├── host/[code]/
│   │   └── page.tsx              # (/host/:code) — Host's room control panel
│   │
│   ├── join/
│   │   └── page.tsx              # (/join) — Guest enters name + code, confirms join
│   │
│   ├── room/[code]/
│   │   └── page.tsx              # (/room/:code) — Guest view (read-only player)
│   │
│   └── api/
│       └── rooms/
│           ├── route.ts           # POST /api/rooms — Create room
│           └── [code]/
│               ├── route.ts       # GET /api/rooms/:code — Fetch room state
│               ├── join/
│               │   └── route.ts   # POST /api/rooms/:code/join — Add guest member
│               ├── player/
│               │   └── route.ts   # POST /api/rooms/:code/player — Host controls
│               └── queue/
│                   └── route.ts   # POST /api/rooms/:code/queue — Add song to queue
│
├── components/
│   └── ui/                        # All UI components live here (flat, no subdirs)
│       ├── Button.tsx
│       ├── Divider.tsx
│       ├── GuestPlayer.tsx
│       ├── HostPlayer.tsx
│       ├── Input.tsx
│       ├── Navbar.tsx
│       ├── PageContainer.tsx
│       ├── ParticipantItem.tsx
│       ├── ParticipantList.tsx
│       ├── QueueInput.tsx
│       └── RoomCode.tsx
│
└── lib/
    └── store.ts                   # In-memory server-side data store + type definitions
```

### 3.2 Data Flow Overview

```
Host browser                         Next.js Server                   Guest browser
    |                                      |                               |
    |-- POST /api/rooms ----------------->  |                               |
    |<-- { roomCode } ------------------   |                               |
    |                                      |                               |
    |-- GET /api/rooms/:code (every 2s) -> |                               |
    |<-- RoomData ----------------------   |                               |
    |                                      |                               |
    |   [Host adds song]                   |   Guest: GET /api/rooms/:code (every 2s) ->
    |-- POST /api/rooms/:code/queue -----> |  <-- RoomData -------------------|
    |                                      |                               |
    |   [Host plays/pauses]                |                               |
    |-- POST /api/rooms/:code/player ----> |                               |
    |                                      |                               |
    |   [HostPlayer reports progress]      |                               |
    |-- POST /api/rooms/:code/player ----> |                               |
    |   { progress: 0.42 }                 |                               |
    |                                      |   Guest polls every 2s, receives
    |                                      |   serverProgress, seeks if drift > 5%
```

---

## 4. The State Store (Critical Architecture Decision)

**File:** [`src/lib/store.ts`](src/lib/store.ts)

The entire application state lives in a **Node.js global in-memory Map**. There is **no database**. This is an intentional early-stage decision to avoid infrastructure complexity.

```typescript
const globalForStore = global as unknown as {
  rooms: Map<string, RoomData> | undefined;
};

export const roomsStore = globalForStore.rooms ?? new Map<string, RoomData>();

if (process.env.NODE_ENV !== "production") {
  globalForStore.rooms = roomsStore;
}
```

The `globalForStore` pattern is required because Next.js hot-reloads modules in dev mode, which would reset the Map on every file change. Attaching it to `global` prevents this.

### Data Shape

```typescript
interface QueueItem {
  id: string;          // "song-{Date.now()}"
  url: string;         // YouTube URL
  title: string;       // Fetched from YouTube oEmbed API
}

interface RoomData {
  hostName: string;
  members: Participant[];      // host + all guests
  queue: QueueItem[];
  currentSongIndex: number;   // 0-based index into queue[]
  isPlaying: boolean;
  progress: number;           // 0.0–1.0 fraction of song duration
  createdAt: number;          // Room creation timestamp
  lastActivity: number;       // Last activity timestamp (for expiry)
}

interface Participant {
  id: string;                 // "host-{Date.now()}" or "user-{Date.now()}"
  name: string;
  isHost?: boolean;           // only true for the room creator
  status: "Online" | "Connected";
}
```

### Known Limitations of In-Memory Store
- **Ephemeral:** All rooms are lost on server restart.
- **Single-process only:** Does not work in multi-instance deployments (e.g. Vercel auto-scaling). This must be replaced with a real store (Redis, DB) before production deployment.
- **Room expiry:** Rooms auto-expire after 24 hours of inactivity via `cleanupExpiredRooms()` function called on room creation.

---

## 5. Synchronization Model (How Playback Sync Works)

This is the most important technical detail in the codebase.

### Polling, with Socket.IO room events starting as a real-time overlay
The current sync model is **HTTP polling at 2-second intervals** on both host and guest pages:

```typescript
interval = setInterval(fetchRoom, 2000);
```

Every 2 seconds, both host and guest fetch `/api/rooms/:code` to get the full `RoomData`.

A new Socket.IO layer has been added to the server and to the host/guest room pages, using the existing room code as the socket room identifier. This lets the host emit room-specific real-time control events directly to every connected guest in the same room while keeping the existing polling model as a fallback.

The first Socket.IO transport step replaces host play/pause control signaling with socket events. Host play and pause actions now emit `PLAY` and `PAUSE` events immediately, and the host also emits a `SEEK` event when track position changes. Guests receive and log these events, but they continue to use HTTP polling for state as a temporary fallback.

### Host → Server: Progress Reporting
The `HostPlayer` component uses the YouTube IFrame API directly. It polls the player's current position every 1 second and sends a POST to `/api/rooms/:code/player` with `{ progress: currentTime/duration }`. This writes the host's current playback fraction (0.0–1.0) to the store.

```typescript
// HostPlayer.tsx - Progress sync with debouncing
const interval = setInterval(() => {
  if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
    const currentTime = playerRef.current.getCurrentTime();
    const duration = playerRef.current.getDuration();
    if (duration > 0) {
      const progress = currentTime / duration;
      setPlayed(progress);

      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTimeRef.current;
      const progressDrift = Math.abs(progress - lastSyncedProgressRef.current);

      if (timeSinceLastSync > 500 || progressDrift > 0.02) {
        lastSyncTimeRef.current = now;
        lastSyncedProgressRef.current = progress;

        fetch(`/api/rooms/${code}/player`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress }),
        }).catch((error) => {
          if (!(error instanceof Error) || error.name !== 'AbortError') {
            console.error('Progress sync error:', error);
          }
        });
      }
    }
  }
}, 1000);
```

> ✅ **Fixed:** Progress sync is debounced — only POSTs to server every 500ms or on >2% drift, significantly reducing API load.

### Guest → Local: Drift Correction
The `GuestPlayer` receives `serverProgress` from the 2-second poll. If the local player has drifted more than 5% from the server value, it seeks using the YouTube API:

```typescript
useEffect(() => {
  if (!playerRef.current || !playerReady) return;

  if (Math.abs(played - serverProgress) > 0.05) {
    setPlayed(serverProgress);
    const duration = playerRef.current.getDuration();
    if (duration > 0) {
      playerRef.current.seekTo(serverProgress * duration, true);
    }
  }
}, [serverProgress, played, playerReady]);
```

Guests have **no playback controls** — they are purely consumers. Only the host controls play/pause/skip.

> ✅ **Fixed:** Both HostPlayer and GuestPlayer now use the YouTube IFrame API directly instead of react-player, eliminating AbortError and audio playback issues.

---

## 6. API Routes Reference

All routes are in `src/app/api/rooms/`.

| Method | Path | Body | Returns | Description |
|---|---|---|---|---|
| `POST` | `/api/rooms` | `{ hostName }` | `{ roomCode }` | Creates room, returns 6-char code |
| `GET` | `/api/rooms/:code` | — | `RoomData` | Full room state snapshot |
| `POST` | `/api/rooms/:code/join` | `{ name }` | `{ success, member }` | Adds a guest to `members[]` |
| `POST` | `/api/rooms/:code/player` | `{ action?, progress? }` | `{ success, room }` | Controls playback state |
| `POST` | `/api/rooms/:code/queue` | `{ url }` | `{ success, queue }` | Adds YouTube URL to queue |

**Player actions:** `"play"`, `"pause"`, `"next"`, `"previous"`

**Auto-play:** When the first song is added to an empty queue, `isPlaying` is set to `true` and `currentSongIndex` to `0` automatically.

**Title resolution:** The queue endpoint calls the YouTube oEmbed API (`https://www.youtube.com/oembed?url={url}&format=json`) to resolve the title server-side. Falls back to `"YouTube Track"` silently on failure.

**Room code format:** 6 characters, uppercase `A-Z0-9`, generated randomly, collision-checked against existing rooms.

---

## 7. Design System

### 7.1 CSS Tokens (`globals.css`)

The project uses **Tailwind v4's `@theme` block** to define all design tokens as CSS variables. There is **no** `tailwind.config.js`. All custom values are here:

```css
@theme {
  --font-inter: 'Inter', sans-serif;
  --color-background: #09090B;      /* Near-black page background */
  --color-surface: #141418;         /* Elevated card/input background */
  --color-primary: #FFFFFF;         /* Primary text */
  --color-secondary: #8B8B95;       /* Muted text, icons */
  --color-accent: #6D5DF6;          /* Purple — primary action color */
  --color-success: #22C55E;         /* Green — online status dots */
  --color-border-subtle: rgba(255, 255, 255, 0.08);  /* Hairline borders */
}
```

Use these as Tailwind utility classes: `bg-background`, `text-secondary`, `border-border-subtle`, `bg-accent`, etc.

### 7.2 Visual Language

- **Dark mode only.** No light mode toggle exists or is planned.
- **Radius:** Large, friendly corners. Buttons: `rounded-[20px]`. Cards/inputs: `rounded-[18px]`–`rounded-[24px]`.
- **Shadows:**
  - Buttons: `shadow-[0_4px_14px_0_rgba(109,93,246,0.39)]` (purple glow)
  - Cards: `shadow-[0_8px_30px_rgb(0,0,0,0.12)]`
  - Inputs: `shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]` (inset depth)
- **Animations:** Framer Motion everywhere. Entry animations use `opacity: 0 → 1`, `y: 10 → 0`, `scale: 0.98 → 1` with the custom ease `[0.16, 1, 0.3, 1]` (a fast-out spring curve).
- **Typography:** Inter, `antialiased`. Headlines at `32px`–`80px` bold. Body at `15px`–`17px` medium.

### 7.3 Component Conventions

| Component | Responsibility |
|---|---|
| `PageContainer` | Full-height centering wrapper, max-width, padding. Use on every page. |
| `Navbar` | Centered "Amply" wordmark that links to `/`. Use on every page. |
| `Button` | Framer Motion button with `primary` (accent purple) and `secondary` (ghost) variants. |
| `Input` | Styled text input with ring focus. Pass all native HTML input props through. |
| `Divider` | 1px horizontal rule in `border-subtle`. |
| `RoomCode` | Displays large letter room code with clipboard copy button. |
| `ParticipantList` | Staggered animation list of `ParticipantItem` rows. |
| `ParticipantItem` | Single member row — name, crown emoji for host, green online dot. |
| `QueueInput` | YouTube URL text input with a `+` add button. Used in both host and guest views. |
| `HostPlayer` | YouTube IFrame API player with play/pause/skip controls. Shows queue list. Makes API calls directly. Host-only. |
| `GuestPlayer` | YouTube IFrame API player. Syncs to server state. Shows queue list. No controls. Guest-only. |

---

## 8. Page-by-Page Breakdown

### `/` — Landing Page
- Two CTAs: "Host a Room" → `/host-setup` and "Join with Code" → `/join`.
- Radial purple glow background effect (absolutely positioned, `blur-[120px]`, `pointer-events-none`).
- Hero text uses a `bg-gradient-to-b from-white to-white/70` clip text effect.

### `/host-setup`
- Single input: host name.
- On submit: `POST /api/rooms` → redirects to `/host/{code}`.
- Disables button until name is non-empty.
- **Keyboard navigation:** Enter key creates room, Esc key returns to home.

### `/host/[code]`
- Polls `GET /api/rooms/:code` every **2 seconds**.
- Shows: `RoomCode` (with copy button), `ParticipantList`, `QueueInput`, `HostPlayer`.
- `HostPlayer` is always rendered (shows "No song in queue" when empty).
- Shows queue list with upcoming songs below the player.
- "Leave" button top-left using Lucide `LogOut` icon.
- `use(params)` required for the dynamic `[code]` param (Next.js 16 async params).

### `/join`
- Two-step flow:
  1. User enters name + code → `GET /api/rooms/:code` validates the room exists.
  2. Confirmation screen: "Join [hostName]'s Room?" → on Yes: `POST /api/rooms/:code/join` → redirect to `/room/:code`.
- Inline error display for invalid codes (red, `#ff5a5a`).
- **Keyboard navigation:** Enter key checks code / confirms join, Esc key cancels / returns to home.

### `/room/[code]`
- Guest view. Polls every **2 seconds**.
- Shows: host name heading, `ParticipantList`, `QueueInput`, `GuestPlayer`.
- Both the "has queue" and "empty queue" states explicitly render `QueueInput` (guests can always add songs).
- `GuestPlayer` receives `serverProgress` for drift correction.
- Shows queue list with upcoming songs below the player.

---

## 9. Coding Conventions

### General
- All client-interactive files use `"use client"` at the top.
- Server-only files (API routes, store) have no `"use client"`.
- **No `"use server"` directives** — server logic lives exclusively in API route handlers.
- TypeScript strict mode is on. No `any` unless absolutely necessary.

### Imports
- Path alias `@/*` resolves to `src/*`. Always use `@/` for internal imports.
- Example: `import { QueueItem } from "@/lib/store"`.

### Naming
- Pages: `page.tsx` (Next.js convention, no name choice).
- Components: PascalCase filenames matching the exported function name.
- Interfaces: Defined in the same file as the component or in `store.ts` for shared types.
- IDs: `"host-{Date.now()}"` / `"user-{Date.now()}"` / `"song-{Date.now()}"` — timestamp-based, not UUID.

### API Route Pattern
All dynamic API routes follow this exact pattern (Next.js 16 async params):

```typescript
type Params = Promise<{ code: string }>;

export async function POST(
  request: Request,
  segmentData: { params: Params }
) {
  const params = await segmentData.params;
  const code = params.code.toUpperCase();
  const room = roomsStore.get(code);
  if (!room) {
    return NextResponse.json({ error: "Room does not exist" }, { status: 404 });
  }
  // ... handler logic
}
```

### Styling
- Use Tailwind utility classes only. No inline `style={{}}` except for dynamic values (e.g. `style={{ width: \`${played * 100}%\` }}`).
- Design tokens (`bg-accent`, `text-secondary`, etc.) from `globals.css` — never hardcode hex colors in className.
- Exception: error text color `#ff5a5a` is currently hardcoded in `/join/page.tsx` — should be tokenized.

---

## 10. Known Issues & Technical Debt

| Issue | Severity | Description |
|---|---|---|
| No WebSocket / SSE | Medium | 2s polling means up to 2s latency on play/pause events. Real-time events via SSE or WebSockets would be a significant improvement. |
| In-memory store | High | Rooms die on server restart. Not horizontally scalable. Needs Redis or a database for production. |
| No error boundaries | Medium | If a page fetch fails, the UI just silently does nothing (caught by try/catch, but not surfaced). |
| Guest leaves silently | Low | When a guest leaves (navigates away), their member entry is never removed from `members[]`. No heartbeat / leave mechanism exists. |
| Room code not in `RoomCode` subtext | Low | `RoomCode` component always says "Waiting for people to join..." even when people have joined. |
| Hardcoded error color | Low | `/join/page.tsx` uses `text-[#ff5a5a]` instead of a CSS token. |
| `package.json` name is `"temp"` | Low | Leftover from scaffolding. Should be updated to `"amply"`. |
| YouTube API autoplay | Low | Browsers require user interaction before audio can play. Player starts muted and unmutes after first click/keypress. |

---

## 11. Roadmap & Future Features

These are either explicitly planned or natural next steps inferred from the product vision:

### Near-Term (Next Steps)
- [x] **Debounce progress sync** — Only push `progress` to server every ~500ms or on drift >2%.
- [x] **Room expiry** — TTL on `RoomData`, auto-clean rooms older than 24 hours.
- [x] **Queue display** — Show the full queue list (song titles) below the player for both host and guests.
- [x] **Keyboard navigation** — Enter to confirm, Esc to back/cancel on join and host-setup pages.
- [x] **YouTube API migration** — Replace react-player with direct YouTube IFrame API to fix AbortError.
- [ ] **Real-time via Socket.IO** — Replace polling with WebSocket/Socket.IO events for instant play/pause propagation.
- [ ] **Guest member cleanup** — Heartbeat endpoint or leave API to remove disconnected guests.
- [ ] **Playback queue UX** — Highlight current song, show next-up, allow reordering.

### Medium-Term
- [ ] **Persistent store** — Redis or Postgres-backed room state for production scalability.
- [ ] **Volume control** — Per-device volume slider (local only, not synced — each device controls its own).
- [ ] **Mobile responsiveness polish** — Current layout works but hasn't been audited on mobile.
- [ ] **Toast notifications** — When someone joins, show a subtle toast on the host's screen.
- [ ] **Song thumbnail** — Show YouTube thumbnail in the player card.

### Long-Term / Exploratory
- [ ] **Multi-source support** — Spotify (via Web Playback SDK), SoundCloud, etc.
- [ ] **Chat sidebar** — Simple text chat within a room.
- [ ] **Host transfer** — Allow host to hand off controls to another participant.
- [ ] **Room persistence** — Optional "save this room" with a vanity URL.

---

## 12. Development Environment

### Running Locally

```bash
cd c:/Users/itsab/Documents/AntiGravity/Amply
npm run dev
```

App runs at `http://localhost:3000`.

### Commands

```bash
npm run dev     # Start dev server (Next.js, hot reload)
npm run build   # Production build
npm run start   # Start production server (after build)
npm run lint    # ESLint
```

### Important Config Files

| File | Purpose |
|---|---|
| `next.config.ts` | Nearly empty — no special Next.js config applied yet |
| `tsconfig.json` | Strict TypeScript, `@/*` path alias to `src/*` |
| `postcss.config.mjs` | Required by Tailwind v4 |
| `eslint.config.mjs` | ESLint with `eslint-config-next` |
| `AGENTS.md` / `CLAUDE.md` | AI agent rules — reads Next.js docs before writing code |

---

## 13. Project Philosophy

1. **Zero friction for users.** No sign-up, no accounts. A room should be joinable in under 30 seconds.
2. **Audio-first.** The YouTube player is always hidden (`width="0" height="0"`). Amply is an audio experience, not a video one.
3. **Host-authoritative playback.** The host's player is the source of truth for position and state. Guests are receivers.
4. **Premium aesthetics, no compromise.** Every interaction has animation. Dark mode, purple accent, glassmorphism-adjacent cards. If it looks like a default Bootstrap page, it's wrong.
5. **Simple over clever.** The codebase is deliberately straightforward. No complex state management libraries (no Zustand, no Redux). Props + `useState` + API polling is intentional for this scale.
6. **Anyone can add to the queue.** This is a collaborative room — guests aren't passive. Both hosts and guests can add YouTube links to the shared queue.

---

## 14. File Quick-Reference

| Path | What it does |
|---|---|
| [`src/lib/store.ts`](src/lib/store.ts) | Global in-memory Map; all type definitions (`RoomData`, `QueueItem`, `Participant`) |
| [`src/app/globals.css`](src/app/globals.css) | Tailwind v4 `@theme` tokens — all design tokens defined here |
| [`src/app/layout.tsx`](src/app/layout.tsx) | Root layout, Inter font, `<html>` and `<body>` wrappers |
| [`src/app/page.tsx`](src/app/page.tsx) | Landing page |
| [`src/app/host-setup/page.tsx`](src/app/host-setup/page.tsx) | Create room flow |
| [`src/app/host/[code]/page.tsx`](src/app/host/%5Bcode%5D/page.tsx) | Host room view (polls, controls) |
| [`src/app/join/page.tsx`](src/app/join/page.tsx) | Two-step join flow |
| [`src/app/room/[code]/page.tsx`](src/app/room/%5Bcode%5D/page.tsx) | Guest room view (polls, syncs) |
| [`src/app/api/rooms/route.ts`](src/app/api/rooms/route.ts) | `POST /api/rooms` — create room |
| [`src/app/api/rooms/[code]/route.ts`](src/app/api/rooms/%5Bcode%5D/route.ts) | `GET /api/rooms/:code` — get state |
| [`src/app/api/rooms/[code]/join/route.ts`](src/app/api/rooms/%5Bcode%5D/join/route.ts) | `POST .../join` — add guest |
| [`src/app/api/rooms/[code]/player/route.ts`](src/app/api/rooms/%5Bcode%5D/player/route.ts) | `POST .../player` — playback control + progress |
| [`src/app/api/rooms/[code]/queue/route.ts`](src/app/api/rooms/%5Bcode%5D/queue/route.ts) | `POST .../queue` — add song |
| [`src/components/ui/HostPlayer.tsx`](src/components/ui/HostPlayer.tsx) | Plays audio, sends progress, has controls |
| [`src/components/ui/GuestPlayer.tsx`](src/components/ui/GuestPlayer.tsx) | Plays audio, no controls, syncs to server |
| [`src/components/ui/QueueInput.tsx`](src/components/ui/QueueInput.tsx) | YouTube URL input, used by both host and guest |
| [`src/components/ui/RoomCode.tsx`](src/components/ui/RoomCode.tsx) | Displays large room code + clipboard copy |
| [`src/components/ui/ParticipantList.tsx`](src/components/ui/ParticipantList.tsx) | Staggered list of participants |
| [`src/components/ui/ParticipantItem.tsx`](src/components/ui/ParticipantItem.tsx) | Single participant row; exports `Participant` type |
| [`src/components/ui/Button.tsx`](src/components/ui/Button.tsx) | Framer Motion button, `primary` / `secondary` variants |
| [`src/components/ui/Input.tsx`](src/components/ui/Input.tsx) | Styled text input |
| [`src/components/ui/Navbar.tsx`](src/components/ui/Navbar.tsx) | Centered "Amply" wordmark |
| [`src/components/ui/PageContainer.tsx`](src/components/ui/PageContainer.tsx) | Full-height centering wrapper |
| [`src/components/ui/Divider.tsx`](src/components/ui/Divider.tsx) | Horizontal 1px divider |
