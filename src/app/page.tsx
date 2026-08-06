"use client";

import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/ui/Navbar";
import { PageContainer } from "@/components/ui/PageContainer";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <PageContainer>
      {/* Subtle radial glow background */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center text-center w-full z-10 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[800px] w-full"
        >
          <h1 className="text-[56px] md:text-[80px] font-bold leading-[1.1] mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">
            One room.<br />
            Every device.<br />
            Perfectly together.
          </h1>
          
          <p className="text-[20px] text-secondary mb-12 max-w-xl mx-auto leading-relaxed">
            Create a listening room in seconds and play music across every connected device.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button className="w-full sm:w-auto min-w-[220px]" onClick={() => router.push("/host-setup")}>
              Host a Room
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto min-w-[220px]" onClick={() => router.push("/join")}>
              Join with Code
            </Button>
          </div>
        </motion.div>
      </main>

      <footer className="w-full text-center pb-8 z-10">
        <span className="text-[13px] text-secondary font-medium tracking-wide opacity-60">
          Designed for shared listening.
        </span>
      </footer>
    </PageContainer>
  );
}
