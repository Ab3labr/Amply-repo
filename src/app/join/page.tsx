"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Navbar } from "@/components/ui/Navbar";
import { PageContainer } from "@/components/ui/PageContainer";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<{code: string, hostName: string} | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (pendingRoom) {
          handleConfirmJoin(true);
        } else if (name && code && !isLoading) {
          handleCheckCode();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (pendingRoom) {
          handleConfirmJoin(false);
        } else {
          router.push("/");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingRoom, name, code, isLoading]);

  const handleCheckCode = async () => {
    if (!name || !code) return;
    setError("");
    setIsLoading(true);
    
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) {
        setError("Room does not exist");
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setPendingRoom({ code: code.toUpperCase(), hostName: data.hostName });
    } catch (e) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmJoin = async (confirm: boolean) => {
    if (!confirm) {
      setPendingRoom(null);
      return;
    }

    if (!pendingRoom) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/rooms/${pendingRoom.code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        router.push(`/room/${pendingRoom.code}`);
      } else {
        setError("Failed to join room");
        setPendingRoom(null);
      }
    } catch (e) {
      setError("An error occurred");
      setPendingRoom(null);
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
          {pendingRoom ? (
            <>
              <h1 className="text-[28px] font-bold text-primary w-full text-center mb-2 tracking-tight">
                Join {pendingRoom.hostName}&apos;s Room?
              </h1>
              <div className="w-full flex flex-col gap-3 mt-4">
                <Button 
                  className="w-full" 
                  onClick={() => handleConfirmJoin(true)}
                  disabled={isLoading}
                >
                  {isLoading ? "Joining..." : "Yes, Join"}
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full" 
                  onClick={() => handleConfirmJoin(false)}
                  disabled={isLoading}
                >
                  No, Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-[32px] font-bold text-primary w-full text-center mb-2 tracking-tight">
                Join a Room
              </h1>
              
              <div className="w-full space-y-4">
                <Input 
                  placeholder="Your Name" 
                  value={name}
                  onChange={(e) => {setName(e.target.value); setError("");}}
                  disabled={isLoading}
                />
                <Input 
                  placeholder="Room Code (e.g. A7F9XQ)" 
                  value={code}
                  onChange={(e) => {setCode(e.target.value); setError("");}}
                  className="uppercase"
                  maxLength={6}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <span className="text-[#ff5a5a] text-[15px] font-medium w-full text-center">{error}</span>
              )}

              <div className="w-full flex flex-col gap-3 mt-4">
                <Button 
                  className="w-full" 
                  onClick={handleCheckCode}
                  disabled={!name || !code || isLoading}
                  style={{ opacity: (!name || !code || isLoading) ? 0.5 : 1 }}
                >
                  {isLoading ? "Checking..." : "Continue"}
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => router.push("/")} disabled={isLoading}>
                  Back
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </main>
    </PageContainer>
  );
}
