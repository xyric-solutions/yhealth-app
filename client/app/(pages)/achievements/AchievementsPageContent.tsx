"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { AchievementsTab } from "@/app/(pages)/dashboard/components/tabs";

function AchievementsLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function AchievementsContent() {
  return (
    <DashboardLayout activeTab="achievements">
      <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <AchievementsTab />
      </div>
    </DashboardLayout>
  );
}

export default function AchievementsPageContent() {
  return (
    <Suspense fallback={<AchievementsLoading />}>
      <AchievementsContent />
    </Suspense>
  );
}
