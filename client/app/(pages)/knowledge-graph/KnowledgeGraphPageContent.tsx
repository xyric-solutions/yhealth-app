'use client';

import { DashboardLayout } from '@/components/layout';
import { KnowledgeGraphTab } from '@/app/(pages)/dashboard/components/tabs/knowledge-graph';

export default function KnowledgeGraphPageContent() {
  return (
    <DashboardLayout activeTab="knowledge-graph">
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Background orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/[0.07] rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-emerald-500/[0.07] rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
          <KnowledgeGraphTab />
        </div>
      </div>
    </DashboardLayout>
  );
}
