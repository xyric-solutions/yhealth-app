"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { ExerciseDetailView } from "./ExerciseDetailView";

function DetailLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );
}

export default function ExerciseDetailPage() {
  return (
    <Suspense fallback={<DetailLoading />}>
      <DashboardLayout activeTab="exercises">
        <ExerciseDetailView />
      </DashboardLayout>
    </Suspense>
  );
}
