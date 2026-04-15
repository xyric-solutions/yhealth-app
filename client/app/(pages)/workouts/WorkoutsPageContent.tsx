"use client";

import { Suspense, useState } from "react";
import { Loader2, Dumbbell, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout";
import { WorkoutsTab } from "@/app/(pages)/dashboard/components/tabs";
import { MusicTab } from "@/app/(pages)/dashboard/components/tabs/music";

function WorkoutsLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function WorkoutsContent() {
  const [activeTab, setActiveTab] = useState<"workouts" | "music">("workouts");

  return (
    <DashboardLayout activeTab="workouts">
      <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
        {/* Page Header */}
        {/* <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Workouts</h1>
        </div> */}

        {/* Tab Switcher — clean underline style */}
        {/* <div className="border-b border-white/[0.06] mb-6">
          <div className="flex gap-0">
            {[
              { id: "workouts" as const, label: "Workouts", icon: <Dumbbell className="w-4 h-4" /> },
              { id: "music" as const, label: "Music", icon: <Music className="w-4 h-4" /> },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="workouts-page-tab"
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-emerald-500"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div> */}

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "workouts" ? (
            <motion.div
              key="workouts"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <WorkoutsTab />
            </motion.div>
          ) : (
            <motion.div
              key="music"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <MusicTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

export default function WorkoutsPageContent() {
  return (
    <Suspense fallback={<WorkoutsLoading />}>
      <WorkoutsContent />
    </Suspense>
  );
}
