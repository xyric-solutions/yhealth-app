"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, List, BarChart3, Settings, Plus, Loader2 } from "lucide-react";
import { StatusIndicator } from "@/app/components/activity/StatusIndicator";
import { StatusCalendar } from "./components/StatusCalendar";
import { StatusTimeline } from "./components/StatusTimeline";
import { StatusStats } from "./components/StatusStats";
import { StatusPickerModal } from "./components/StatusPickerModal";
import { activityStatusService } from "@/src/shared/services/activity-status.service";
import { Button } from "@/components/ui/button";
import { DashboardUnderlineTabs } from "@/app/(pages)/dashboard/components/DashboardUnderlineTabs";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/app/context/AuthContext";

type InternalTabType = "calendar" | "timeline" | "stats" | "settings";

function ActivityStatusPageInner() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();


  // Internal tab state

  // Internal page tab state
  const [activeTab, setActiveTab] = useState<InternalTabType>("calendar");
  const [, setCurrentStatus] = useState<string>("working");
  const [isNewStatusModalOpen, setIsNewStatusModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle sidebar tab change
  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/signin?callbackUrl=/activity-status");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      // eslint-disable-next-line react-hooks/immutability
      loadCurrentStatus();
    }
  }, [isAuthenticated]);

  const loadCurrentStatus = async () => {
    try {
      const response = await activityStatusService.getCurrent();
      if (response.success && response.data) {
        setCurrentStatus(response.data.status);
      }
    } catch (error) {
      console.error("Failed to load current status:", error);
    }
  };

  // Get today's date in YYYY-MM-DD format using local timezone
  const getTodayDate = (): string => {
    const today = new Date();
    // Use local timezone methods, not UTC
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleNewStatusSuccess = () => {
    setRefreshKey((prev) => prev + 1);
    loadCurrentStatus();
  };

  const tabs = [
    { id: "calendar" as InternalTabType, label: "Calendar", icon: Calendar },
    { id: "timeline" as InternalTabType, label: "Timeline", icon: List },
    { id: "stats" as InternalTabType, label: "Statistics", icon: BarChart3 },
    { id: "settings" as InternalTabType, label: "Settings", icon: Settings },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <motion.div
              className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 blur-xl"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <p className="text-slate-400">Loading...</p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout activeTab="activity-status">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-600/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-sky-600/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-full">
          <div className="container mx-auto px-4 py-8 max-w-8xl">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold mb-2 text-white">Activity Status</h1>
                  <p className="text-slate-400">
                    Track your daily activity status and mood
                  </p>
                </div>
                <StatusIndicator showLabel />
              </div>

              <DashboardUnderlineTabs
                layoutId="activityStatusSubTabUnderline"
                activeId={activeTab}
                onTabChange={(id) => setActiveTab(id as InternalTabType)}
                tabs={tabs.map((t) => ({
                  id: t.id,
                  label: t.label,
                  icon: t.icon,
                }))}
              />
            </motion.div>

            {/* Tab Content */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === "calendar" && <StatusCalendar key={refreshKey} />}
              {activeTab === "timeline" && <StatusTimeline key={refreshKey} />}
              {activeTab === "stats" && <StatusStats key={refreshKey} />}
              {activeTab === "settings" && (
                <div className="bg-slate-900/80 rounded-xl border border-white/10 p-6">
                  <h2 className="text-xl font-semibold mb-4 text-white">Settings</h2>
                  <p className="text-slate-400">
                    Settings and preferences will be available here.
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Floating Action Button */}
          <motion.div
            className="fixed bottom-24 md:bottom-6 right-6 z-50"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Button
              onClick={() => setIsNewStatusModalOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 shadow-lg shadow-emerald-600/40 hover:shadow-emerald-600/60 transition-all"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </motion.div>

          {/* New Status Modal */}
          <StatusPickerModal
            open={isNewStatusModalOpen}
            onOpenChange={setIsNewStatusModalOpen}
            date={getTodayDate()}
            onSuccess={handleNewStatusSuccess}
          />
        </div>
    </DashboardLayout>
  );
}

export default function ActivityStatusPageContent() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <motion.div
              className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 blur-xl"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <p className="text-slate-400">Loading...</p>
        </motion.div>
      </div>
    }>
      <ActivityStatusPageInner />
    </Suspense>
  );
}
