"use client";

import { Topbar } from "@/components/ui/Topbar";
import { QueuePanel } from "@/components/ui/QueuePanel";
import { Toast } from "@/components/ui/Toast";
import { GuestPlayer, type SocketCommand } from "@/components/ui/GuestPlayer";
import { RoomData } from "@/lib/store";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

export default function GuestRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  
  const [roomState, setRoomState] = useState<RoomData | null>(null);
  const [socketCommand, setSocketCommand] = useState<SocketCommand | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[GUEST SOCKET] connected id=${socket.id}`);
      socket.emit("JOIN_ROOM", { roomCode: code, role: "guest" });
    });

    socket.on("disconnect", () => {
      console.log("[GUEST SOCKET] disconnected");
    });

    socket.on("ROOM_SYNC", (payload: any) => {
      console.log("[GUEST SOCKET] ROOM_SYNC received", payload);
    });

    socket.on("PLAY", (payload: any) => {
      console.log("[GUEST SOCKET] PLAY received", payload);
      setSocketCommand({ type: "play", at: Date.now() });
    });

    socket.on("PAUSE", (payload: any) => {
      console.log("[GUEST SOCKET] PAUSE received", payload);
      setSocketCommand({ type: "pause", at: Date.now() });
    });

    socket.on("SEEK", (payload: any) => {
      console.log("[GUEST SOCKET] SEEK received", payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [code]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`);
        if (res.ok) {
          const data = await res.json();
          setRoomState(data);
        } else {
          router.push("/");
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchRoom();
    interval = setInterval(fetchRoom, 2000);

    return () => clearInterval(interval);
  }, [code, router]);

  return (
    <div className="app-shell flex min-h-dvh flex-col bg-background lg:h-dvh lg:overflow-hidden">
      <Toast />
      <Topbar code={code} members={roomState?.members || []} onLeave={() => router.push("/")} />

      <main className="grid w-full min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_384px]">
        <div className="relative flex min-h-0 flex-col overflow-hidden">
          <GuestPlayer
            queue={roomState?.queue || []}
            currentSongIndex={roomState?.currentSongIndex || 0}
            isPlaying={roomState?.isPlaying || false}
            serverProgress={roomState?.progress ?? 0}
            socketCommand={socketCommand}
            hostName={roomState?.hostName}
          />
        </div>

        <QueuePanel
          code={code}
          queue={roomState?.queue || []}
          currentSongIndex={roomState?.currentSongIndex || 0}
          isPlaying={roomState?.isPlaying || false}
        />
      </main>
    </div>
  );
}
