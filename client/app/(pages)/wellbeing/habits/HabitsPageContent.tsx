"use client";

import { Suspense } from "react";
import { Loader2, Target, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { HabitDashboard } from "@/app/(pages)/dashboard/components/wellbeing";

function HabitsContent() {
  const router = useRouter();

  return (
    <DashboardLayout activeTab="wellbeing">
      <div className="flex flex-col h-full min-h-screen bg-[#0a0a0f]">
        {/* ── Sticky Top Bar ── */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl px-4 sm:px-6 h-12">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/wellbeing")}
              className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white hidden sm:inline">
                Habit Tracking
              </span>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
            <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
              <HabitDashboard />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function HabitsLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
    </div>
  );
}

export default function HabitsPageContent() {
  return (
    <Suspense fallback={<HabitsLoading />}>
      <HabitsContent />
    </Suspense>
  );
}
