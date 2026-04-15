"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { ProgressTab } from "@/app/(pages)/dashboard/components/tabs";

function ProgressLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ProgressContent() {
  return (
    <DashboardLayout activeTab="progress">
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Subtle emerald glow effect */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <ProgressTab />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ProgressPageContent() {
  return (
    <Suspense fallback={<ProgressLoading />}>
      <ProgressContent />
    </Suspense>
  );
}
