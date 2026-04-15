"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Home, ArrowLeft, Search, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

// Floating particle component
function Particle({ delay, duration, x, y, size }: {
  delay: number;
  duration: number;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full bg-emerald-500/20"
      style={{ width: size, height: size }}
      initial={{ x, y, opacity: 0, scale: 0 }}
      animate={{
        // eslint-disable-next-line react-hooks/purity
        x: [x, x + Math.random() * 100 - 50],
        // eslint-disable-next-line react-hooks/purity
        y: [y, y - 80 - Math.random() * 60],
        opacity: [0, 0.6, 0],
        scale: [0, 1, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}

// Animated glitch text
function GlitchText({ children }: { children: string }) {
  return (
    <div className="relative select-none">
      <motion.span
        className="absolute inset-0 text-emerald-500/30 blur-[1px]"
        animate={{
          x: [0, -3, 3, -1, 0],
          y: [0, 1, -1, 0, 0],
        }}
        transition={{
          duration: 0.3,
          repeat: Infinity,
          repeatDelay: 4,
          ease: "easeInOut",
        }}
        aria-hidden
      >
        {children}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-sky-500/30 blur-[1px]"
        animate={{
          x: [0, 3, -3, 1, 0],
          y: [0, -1, 1, 0, 0],
        }}
        transition={{
          duration: 0.3,
          repeat: Infinity,
          repeatDelay: 4,
          delay: 0.05,
          ease: "easeInOut",
        }}
        aria-hidden
      >
        {children}
      </motion.span>
      <span className="relative">{children}</span>
    </div>
  );
}

export default function NotFound() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Animated background gradient */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, rgba(14, 165, 233, 0.15) 0%, transparent 50%)",
              "radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating particles */}
        {mounted && (
          <>
            {Array.from({ length: 20 }).map((_, i) => (
              <Particle
                key={i}
                delay={i * 0.5}
                // eslint-disable-next-line react-hooks/purity
                duration={3 + Math.random() * 2}
                // eslint-disable-next-line react-hooks/purity
                x={Math.random() * (typeof window !== "undefined" ? window.innerWidth : 1200)}
                // eslint-disable-next-line react-hooks/purity
                y={Math.random() * (typeof window !== "undefined" ? window.innerHeight : 800)}
                // eslint-disable-next-line react-hooks/purity
                size={3 + Math.random() * 6}
              />
            ))}
          </>
        )}
      </div>

      {/* Parallax orbs */}
      <motion.div
        className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-emerald-500/5 blur-3xl"
        animate={{
          x: mousePos.x * 0.5,
          y: mousePos.y * 0.5,
        }}
        transition={{ type: "spring", stiffness: 50, damping: 30 }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-sky-500/5 blur-3xl"
        animate={{
          x: mousePos.x * -0.3,
          y: mousePos.y * -0.3,
        }}
        transition={{ type: "spring", stiffness: 50, damping: 30 }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* 404 Number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.8, bounce: 0.4 }}
          className="mb-6"
        >
          <div className="text-[10rem] md:text-[14rem] font-black leading-none tracking-tighter bg-linear-to-b from-white via-slate-300 to-slate-600 bg-clip-text text-transparent">
            <GlitchText>404</GlitchText>
          </div>
        </motion.div>

        {/* Animated line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          className="h-px w-48 mx-auto mb-8 bg-linear-to-r from-transparent via-emerald-500/50 to-transparent"
        />

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-2xl md:text-3xl font-bold text-white mb-4"
        >
          Page Not Found
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-slate-400 text-base md:text-lg max-w-md mx-auto mb-10 leading-relaxed"
        >
          The page you&apos;re looking for seems to have wandered off on its own
          health journey. Let&apos;s get you back on track.
        </motion.p>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            asChild
            size="lg"
            className="bg-linear-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] px-8"
          >
            <Link href="/">
              <Home className="w-5 h-5 mr-2" />
              Go Home
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/60 hover:text-white hover:border-slate-600 backdrop-blur-sm px-8"
          >
            <Link href="/dashboard">
              <Compass className="w-5 h-5 mr-2" />
              Dashboard
            </Link>
          </Button>
        </motion.div>

        {/* Quick links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm"
        >
          <Link
            href="/blogs"
            className="text-slate-500 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            Browse Blogs
          </Link>
          <span className="text-slate-800">|</span>
          <button
            onClick={() => window.history.back()}
            className="text-slate-500 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
        </motion.div>
      </div>
    </div>
  );
}
