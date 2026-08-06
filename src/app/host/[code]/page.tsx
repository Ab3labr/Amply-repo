"use client";

import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { Navbar } from "@/components/ui/Navbar";
import { PageContainer } from "@/components/ui/PageContainer";
import { ParticipantList } from "@/components/ui/ParticipantList";
import { RoomCode } from "@/components/ui/RoomCode";
import { HostPlayer } from "@/components/ui/HostPlayer";
import { HostPlayerErrorBoundary } from "@/components/ui/HostPlayerErrorBoundary";
import { QueueInput } from "@/components/ui/QueueInput";
import { RoomData } from "@/lib/store";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { io, type Socket } from "socket.io-client";

export default function HostRoomPage({ params }: { params: Promise<{ code: string }> }) {
  console.log('[HOST PAGE] Component render');
  const resolvedParams = use(params);
  const code = resolvedParams.code;

  const [roomState, setRoomState] = useState<RoomData | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  // Component mount/unmount logging
  useEffect(() => {
    console.log('[HOST PAGE] Component MOUNTED');
    return () => {
      console.log('[HOST PAGE] Component UNMOUNTING');
    };
  }, []);

  useEffect(() => {
    console.log('[HOST PAGE] Socket.IO useEffect executing');
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      try {
        console.log(`[HOST SOCKET] connected id=${socket.id}`);
        socket.emit("JOIN_ROOM", { roomCode: code, role: "host" });
        socket.emit("ROOM_SYNC", { roomCode: code, message: "sync-test", timestamp: Date.now() });
      } catch (error) {
        console.error('[HOST SOCKET] Error in connect handler:', error);
      }
    });

    socket.on("disconnect", () => {
      try {
        console.log("[HOST SOCKET] disconnected");
      } catch (error) {
        console.error('[HOST SOCKET] Error in disconnect handler:', error);
      }
    });

    socket.on("ROOM_SYNC", (payload: any) => {
      try {
        console.log("[HOST SOCKET] ROOM_SYNC received", payload);
      } catch (error) {
        console.error('[HOST SOCKET] Error in ROOM_SYNC handler:', error);
      }
    });

    socket.on("PLAY", (payload: any) => {
      try {
        console.log("[HOST SOCKET] PLAY received", payload);
      } catch (error) {
        console.error('[HOST SOCKET] Error in PLAY handler:', error);
      }
    });

    socket.on("PAUSE", (payload: any) => {
      try {
        console.log("[HOST SOCKET] PAUSE received", payload);
      } catch (error) {
        console.error('[HOST SOCKET] Error in PAUSE handler:', error);
      }
    });

    socket.on("SEEK", (payload: any) => {
      try {
        console.log("[HOST SOCKET] SEEK received", payload);
      } catch (error) {
        console.error('[HOST SOCKET] Error in SEEK handler:', error);
      }
    });

    return () => {
      console.log('[HOST PAGE] Socket.IO useEffect cleanup - disconnecting socket');
      try {
        socket.disconnect();
      } catch (error) {
        console.error('[HOST PAGE] Error disconnecting socket:', error);
      }
    };
  }, [code]);

  const emitPlay = () => {
    console.log('[HOST PAGE] emitPlay called');
    try {
      socketRef.current?.emit("PLAY", { roomCode: code, timestamp: Date.now() });
    } catch (error) {
      console.error('[HOST PAGE] Error in emitPlay:', error);
    }
  };

  const emitPause = () => {
    console.log('[HOST PAGE] emitPause called');
    try {
      socketRef.current?.emit("PAUSE", { roomCode: code, timestamp: Date.now() });
    } catch (error) {
      console.error('[HOST PAGE] Error in emitPause:', error);
    }
  };

  const emitSeek = (position: number) => {
    console.log('[HOST PAGE] emitSeek called', { position });
    try {
      socketRef.current?.emit("SEEK", {
        roomCode: code,
        position,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[HOST PAGE] Error in emitSeek:', error);
    }
  };

  useEffect(() => {
    console.log('[HOST PAGE] Room polling useEffect starting');
    let interval: NodeJS.Timeout;

    const fetchRoom = async () => {
      try {
        console.log('[HOST PAGE] Fetching room state');
        const res = await fetch(`/api/rooms/${code}`);
        if (res.ok) {
          const data = await res.json();
          console.log('[HOST PAGE] Room state received:', {
            queueLength: data.queue?.length,
            currentSongIndex: data.currentSongIndex,
            isPlaying: data.isPlaying,
            progress: data.progress
          });
          setRoomState(data);
        } else {
          console.error('[HOST PAGE] Room fetch failed, redirecting');
          router.push("/");
        }
      } catch (e) {
        console.error('[HOST PAGE] Room fetch error:', e);
      }
    };

    fetchRoom();
    interval = setInterval(fetchRoom, 2000);

    return () => {
      console.log('[HOST PAGE] Room polling useEffect cleanup');
      clearInterval(interval);
    };
  }, [code, router]);

  return (
    <PageContainer>
      <div className="absolute top-6 left-6 z-20">
        <button onClick={() => router.push("/")} className="text-secondary hover:text-primary flex items-center gap-2 transition-colors">
          <LogOut size={20} />
          <span>Leave</span>
        </button>
      </div>

      <Navbar />

      <main className="flex-1 w-full max-w-[500px] flex flex-col items-center justify-start mt-8 mb-20 z-10 mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex flex-col items-center"
        >
          <div className="mb-10 w-full">
            <RoomCode code={code} />
          </div>

          <div className="w-full mb-6">
            <ParticipantList participants={roomState?.members || []} />
          </div>

          <Divider />

          {/* Queue & Player */}
          <div className="w-full flex flex-col items-center mt-2">
            <h2 className="text-[22px] font-semibold text-primary w-full text-center">Party Queue</h2>
            <QueueInput code={code} />

            <HostPlayerErrorBoundary>
              <HostPlayer
                code={code}
                queue={roomState?.queue || []}
                currentSongIndex={roomState?.currentSongIndex || 0}
                isPlaying={roomState?.isPlaying || false}
                onPlay={emitPlay}
                onPause={emitPause}
                onSeek={emitSeek}
              />
            </HostPlayerErrorBoundary>
          </div>
        </motion.div>
      </main>
    </PageContainer>
  );
}
