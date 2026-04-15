"use client";

import { DashboardLayout } from "@/components/layout";
import { PreferencesTab } from "@/app/(pages)/dashboard/components/tabs/PreferencesTab";

export default function PreferencesPageContent() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PreferencesTab />
        </div>
      </div>
    </DashboardLayout>
  );
}
