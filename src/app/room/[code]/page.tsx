"use client";

import { Navbar } from "@/components/ui/Navbar";
import { PageContainer } from "@/components/ui/PageContainer";
import { ParticipantList } from "@/components/ui/ParticipantList";
import { GuestPlayer } from "@/components/ui/GuestPlayer";
import { QueueInput } from "@/components/ui/QueueInput";
import { RoomData } from "@/lib/store";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { io, type Socket } from "socket.io-client";

export default function GuestRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  
  const [roomState, setRoomState] = useState<RoomData | null>(null);
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
    });

    socket.on("PAUSE", (payload: any) => {
      console.log("[GUEST SOCKET] PAUSE received", payload);
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
          <div className="mb-8 w-full text-center">
            <h1 className="text-[28px] font-bold text-primary mb-2 tracking-tight">
              {roomState?.hostName ? `${roomState.hostName}'s Room` : "Loading..."}
            </h1>
            <p className="text-[15px] text-secondary">You are connected to the room.</p>
          </div>

          <div className="w-full mb-6">
            <ParticipantList participants={roomState?.members || []} />
          </div>
          
          {roomState?.queue && roomState.queue.length > 0 && (
            <div className="w-full mt-2 border-t border-border-subtle pt-8">
              <h2 className="text-lg font-semibold text-primary w-full text-center">Party Queue</h2>
              <QueueInput code={code} />
              <GuestPlayer 
                queue={roomState.queue} 
                currentSongIndex={roomState.currentSongIndex} 
                isPlaying={roomState.isPlaying} 
                serverProgress={roomState.progress}
              />
            </div>
          )}
          
          {roomState?.queue && roomState.queue.length === 0 && (
            <div className="w-full mt-2 border-t border-border-subtle pt-8">
              <h2 className="text-lg font-semibold text-primary w-full text-center mb-4">Party Queue</h2>
              <QueueInput code={code} />
            </div>
          )}

        </motion.div>
      </main>
    </PageContainer>
  );
}
