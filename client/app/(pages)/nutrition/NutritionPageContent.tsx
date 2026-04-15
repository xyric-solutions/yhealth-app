"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { NutritionTab } from "@/app/(pages)/dashboard/components/tabs";

function NutritionLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function NutritionContent() {
  return (
    <DashboardLayout activeTab="nutrition">
      <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <NutritionTab />
      </div>
    </DashboardLayout>
  );
}

export default function NutritionPageContent() {
  return (
    <Suspense fallback={<NutritionLoading />}>
      <NutritionContent />
    </Suspense>
  );
}
