"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { ExercisesView } from "./ExercisesView";

function ExercisesLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );
}

function ExercisesContent() {
  return (
    <DashboardLayout activeTab="exercises">
      <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <ExercisesView />
      </div>
    </DashboardLayout>
  );
}

export default function ExercisesPageContent() {
  return (
    <Suspense fallback={<ExercisesLoading />}>
      <ExercisesContent />
    </Suspense>
  );
}
