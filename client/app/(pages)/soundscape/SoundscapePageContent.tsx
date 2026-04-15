"use client";

import { DashboardLayout } from "@/components/layout";
import { MusicTab } from "@/app/(pages)/dashboard/components/tabs/music";

export default function SoundscapePageContent() {
  return (
    <DashboardLayout activeTab="soundscape">
      <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a0f]">
        <MusicTab />
      </div>
    </DashboardLayout>
  );
}
