# Socket.IO Integration Changes

This file summarizes the exact changes made to add minimal Socket.IO room support to the existing Amply application.

## Files changed

### `server.js`
- Added `JOIN_ROOM` event handling.
- Added `ROOM_SYNC` event handling.
- Updated experiment state tracking to preserve socket room membership.
- Kept existing experiment logic intact.
- `JOIN_ROOM` makes sockets join a room keyed by the existing `roomCode`.
- `ROOM_SYNC` broadcasts events to other sockets in the same room.

### `src/app/host/[code]/page.tsx`
- Added `socket.io-client` import and `Socket` type.
- Initialized a Socket.IO client and connected to `/socket.io`.
- Joined the room using the existing room code on `connect`.
- Sent a test `ROOM_SYNC` event from host to the room at connect-time.
- Added `PLAY`, `PAUSE`, and `SEEK` event emission helpers.
- Passed `onPlay`, `onPause`, and `onSeek` callbacks into `HostPlayer`.
- Preserved existing HTTP polling behavior.

### `src/components/ui/HostPlayer.tsx`
- Added `onPlay`, `onPause`, and `onSeek` callback props.
- Emitted the callbacks when the host toggles play/pause.
- Emitted the seek callback during next/previous track changes as a provisional host-side position event.
- Preserved all existing playback controls and polling logic.

### `src/app/room/[code]/page.tsx`
- Added `socket.io-client` import and `Socket` type.
- Initialized a Socket.IO client and connected to `/socket.io`.
- Joined the room using the existing room code on `connect`.
- Added listeners for `PLAY`, `PAUSE`, and `SEEK` events.
- Logged received play/pause/seek events to the guest console.
- Preserved existing HTTP polling behavior.

### `AI_CONTEXT.md`
- Updated the synchronization model section to note that Socket.IO room events were added as a real-time overlay.
- Updated the roadmap item from SSE to Socket.IO.

## Testing notes
- Existing app behavior and polling were preserved.
- New Socket.IO layer is additive and does not replace polling yet.
- Minimal test event is emitted by the host when the socket connects.

## What was not changed
- UI, layouts, styling, room creation, room joining, queue functionality, and YouTube IFrame playback were not modified.
- No scheduled playback, clock sync, drift correction, AudioContext, Redis, or adaptive latency logic was added.
