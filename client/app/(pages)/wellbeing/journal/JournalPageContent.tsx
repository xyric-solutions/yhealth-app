"use client";

import { Suspense, useState } from "react";
import { Loader2, BookOpen, Flame, Sparkles, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  JournalEntryForm,
  JournalHistory,
  JournalStreaks,
  JournalPrompt,
} from "@/app/(pages)/dashboard/components/wellbeing";
import type { JournalPrompt as JournalPromptType } from "@/src/shared/services/wellbeing.service";

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-indigo-400" />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  );
}

function JournalContent() {
  const [showEntry, setShowEntry] = useState(false);
  const [selectedPrompt, setSelectedPrompt] =
    useState<JournalPromptType | null>(null);
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
              <BookOpen className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white hidden sm:inline">
                Daily Journaling
              </span>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setShowEntry(true)}
            className="h-7 px-3 text-xs bg-indigo-500/90 hover:bg-indigo-500 text-white border-0 rounded-md"
          >
            <BookOpen className="h-3 w-3 mr-1" />
            New Entry
          </Button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5">
            {/* Main Grid: 2/3 + 1/3 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left — History */}
              <div className="lg:col-span-2">
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={BookOpen} title="Journal History" />
                  <JournalHistory limit={20} onRefresh={() => {}} />
                </div>
              </div>

              {/* Right — Sidebar */}
              <div className="space-y-5">
                {/* Streak */}
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Flame} title="Streak" />
                  <JournalStreaks />
                </div>

                {/* Prompts */}
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Sparkles} title="Prompts" />
                  <JournalPrompt
                    onSelectPrompt={(prompt) => {
                      setSelectedPrompt(prompt);
                      setShowEntry(true);
                    }}
                    limit={5}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Journal Entry Modal ── */}
        <AnimatePresence>
          {showEntry && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowEntry(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 12 }}
                transition={{ type: "spring", damping: 28, stiffness: 350 }}
                onClick={(e) => e.stopPropagation()}
                className="rounded-xl border border-white/[0.08] bg-[#0f0f18] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-5">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
                      <BookOpen className="h-4 w-4 text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      New Journal Entry
                    </h3>
                  </div>
                  <JournalEntryForm
                    selectedPrompt={selectedPrompt}
                    onSuccess={() => {
                      setShowEntry(false);
                      setSelectedPrompt(null);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("journal-logged"));
                      }
                    }}
                    onCancel={() => {
                      setShowEntry(false);
                      setSelectedPrompt(null);
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function JournalLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
    </div>
  );
}

export default function JournalPageContent() {
  return (
    <Suspense fallback={<JournalLoading />}>
      <JournalContent />
    </Suspense>
  );
}
