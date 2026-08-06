"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Navbar } from "@/components/ui/Navbar";
import { PageContainer } from "@/components/ui/PageContainer";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HostSetupPage() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (name && !isLoading) {
          handleCreateRoom();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        router.push("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [name, isLoading]);

  const handleCreateRoom = async () => {
    if (!name) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: name }),
      });
      const data = await res.json();
      if (data.roomCode) {
        router.push(`/host/${data.roomCode}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer>
      <Navbar />
      <main className="flex-1 w-full max-w-[400px] flex flex-col items-center justify-center mt-12 mb-20 z-10 mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full flex flex-col items-center gap-6"
        >
          <h1 className="text-[32px] font-bold text-primary w-full text-center mb-2 tracking-tight">
            Host a Room
          </h1>
          <div className="w-full space-y-4">
            <Input 
              placeholder="Your Name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="w-full flex flex-col gap-3 mt-4">
            <Button 
              className="w-full" 
              onClick={handleCreateRoom}
              disabled={!name || isLoading}
              style={{ opacity: (!name || isLoading) ? 0.5 : 1 }}
            >
              {isLoading ? "Creating..." : "Create Room"}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => router.push("/")} disabled={isLoading}>
              Back
            </Button>
          </div>
        </motion.div>
      </main>
    </PageContainer>
  );
}
