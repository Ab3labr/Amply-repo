import { NextResponse } from "next/server";
import { roomsStore } from "@/lib/store";

type Params = Promise<{ code: string }>;

export async function POST(
  request: Request,
  segmentData: { params: Params }
) {
  try {
    const params = await segmentData.params;
    const code = params.code.toUpperCase();
    const room = roomsStore.get(code);

    if (!room) {
      return NextResponse.json({ error: "Room does not exist" }, { status: 404 });
    }

    const { action, progress } = await request.json();

    if (action === "play") {
      room.isPlaying = true;
    } else if (action === "pause") {
      room.isPlaying = false;
    } else if (action === "next") {
      if (room.currentSongIndex < room.queue.length - 1) {
        room.currentSongIndex += 1;
        room.progress = 0;
        room.isPlaying = true;
      } else {
        room.isPlaying = false;
      }
    } else if (action === "previous") {
      if (room.currentSongIndex > 0) {
        room.currentSongIndex -= 1;
        room.progress = 0;
        room.isPlaying = true;
      }
    }

    if (progress !== undefined) {
      room.progress = progress;
    }

    room.lastActivity = Date.now();
    roomsStore.set(code, room);

    return NextResponse.json({ success: true, room }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to sync player" }, { status: 500 });
  }
}
