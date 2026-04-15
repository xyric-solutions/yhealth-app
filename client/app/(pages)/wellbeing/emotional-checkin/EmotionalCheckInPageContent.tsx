"use client";

import { Suspense } from "react";
import { Loader2, Heart, ArrowLeft, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { EmotionalCheckInFlow } from "@/app/(pages)/dashboard/components/emotional-checkin/EmotionalCheckInFlow";

function EmotionalCheckInContent() {
  const router = useRouter();

  return (
    <DashboardLayout activeTab="wellbeing">
      <div className="flex flex-col h-full min-h-screen bg-[#0a0a0f]">
        {/* ── Sticky Top Bar ── */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl px-4 sm:px-6 h-12">
          <button
            onClick={() => router.push("/wellbeing")}
            className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-400" />
            <span className="text-sm font-semibold text-white hidden sm:inline">
              Emotional Check-In
            </span>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
            {/* Disclaimer */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5"
            >
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200/80 leading-relaxed">
                <strong className="text-amber-200">Note:</strong> This is a
                wellbeing check-in, not a diagnosis. This tool helps you notice
                patterns and offers supportive guidance.
              </p>
            </motion.div>

            {/* Check-In Flow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
            >
              <EmotionalCheckInFlow />
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function EmotionalCheckInLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
    </div>
  );
}

export default function EmotionalCheckInPageContent() {
  return (
    <Suspense fallback={<EmotionalCheckInLoading />}>
      <EmotionalCheckInContent />
    </Suspense>
  );
}
