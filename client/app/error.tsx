"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Animated broken circuit lines
function CircuitLine({ d, delay }: { d: string; delay: number }) {
  return (
    <motion.path
      d={d}
      stroke="currentColor"
      strokeWidth="1"
      fill="none"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.15 }}
      transition={{ duration: 1.5, delay, ease: "easeOut" }}
    />
  );
}

// Pulsing warning ring
function PulseRing({ delay, size }: { delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full border border-red-500/20"
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0, 0.4, 0],
        scale: [0.8, 1.2, 1.4],
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Log the error
    console.error("Application error:", error);
  }, [error]);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      reset();
      setIsRetrying(false);
    }, 800);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            background: [
              "radial-gradient(circle at 30% 40%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)",
              "radial-gradient(circle at 70% 60%, rgba(239, 68, 68, 0.08) 0%, transparent 50%)",
              "radial-gradient(circle at 30% 40%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Circuit pattern SVG */}
        <svg
          className="absolute inset-0 w-full h-full text-slate-500"
          xmlns="http://www.w3.org/2000/svg"
        >
          <CircuitLine d="M 0 200 Q 200 180 400 200 T 800 200" delay={0} />
          <CircuitLine d="M 100 400 Q 300 380 500 400 T 900 400" delay={0.3} />
          <CircuitLine d="M 50 600 Q 250 620 450 600 T 850 600" delay={0.6} />
          <CircuitLine d="M 200 100 L 200 300 L 400 300" delay={0.2} />
          <CircuitLine d="M 600 50 L 600 250 L 800 250" delay={0.5} />
          <CircuitLine d="M 700 400 L 700 600 L 500 600" delay={0.8} />
        </svg>

        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
      </div>

      {/* Decorative orbs */}
      <div className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full bg-red-500/5 blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-orange-500/5 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-xl mx-auto">
        {/* Warning icon with pulse rings */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.8, bounce: 0.4 }}
          className="relative flex items-center justify-center mb-8"
        >
          <PulseRing delay={0} size={160} />
          <PulseRing delay={1} size={160} />
          <PulseRing delay={2} size={160} />

          <motion.div
            className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm"
            animate={{
              boxShadow: [
                "0 0 20px rgba(239, 68, 68, 0.1)",
                "0 0 40px rgba(239, 68, 68, 0.2)",
                "0 0 20px rgba(239, 68, 68, 0.1)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <motion.div
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
            >
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-2xl md:text-3xl font-bold text-white mb-4"
        >
          Something Went Wrong
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-slate-400 text-base md:text-lg max-w-md mx-auto mb-8 leading-relaxed"
        >
          We encountered an unexpected error. Don&apos;t worry, our team has
          been notified and is working on a fix.
        </motion.p>

        {/* Error details (collapsible) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            <Bug className="w-3.5 h-3.5" />
            {showDetails ? "Hide" : "Show"} error details
            {showDetails ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/60 text-left overflow-hidden"
            >
              <p className="text-xs font-mono text-red-400/80 break-all">
                {error.message || "Unknown error"}
              </p>
              {error.digest && (
                <p className="text-xs font-mono text-slate-600 mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            size="lg"
            className="bg-linear-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg shadow-red-500/20 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] px-8 disabled:opacity-70"
          >
            <RefreshCw
              className={`w-5 h-5 mr-2 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? "Retrying..." : "Try Again"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/60 hover:text-white hover:border-slate-600 backdrop-blur-sm px-8"
          >
            <Link href="/">
              <Home className="w-5 h-5 mr-2" />
              Go Home
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
