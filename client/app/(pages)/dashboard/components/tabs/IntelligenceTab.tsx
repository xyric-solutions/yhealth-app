'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, Sparkles, FileText, Activity } from 'lucide-react';
import { InsightFeed } from './intelligence/InsightFeed';
import { CorrelationExplorer } from './intelligence/CorrelationExplorer';
import { PredictionTracker } from './intelligence/PredictionTracker';
import { ReportViewer } from './intelligence/ReportViewer';
import { HealthScoreBreakdown } from './intelligence/HealthScoreBreakdown';
import { DashboardUnderlineTabs } from '../DashboardUnderlineTabs';

const SUB_TABS = [
  { id: 'insights', label: 'Insights', icon: Sparkles },
  { id: 'correlations', label: 'Correlations', icon: TrendingUp },
  { id: 'predictions', label: 'Predictions', icon: Brain },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'health-score', label: 'Health Score', icon: Activity },
] as const;

type SubTabId = (typeof SUB_TABS)[number]['id'];

export function IntelligenceTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('insights');

  return (
    <div className="space-y-6">
      <DashboardUnderlineTabs
        layoutId="intelligenceSubTabUnderline"
        activeId={activeSubTab}
        onTabChange={(id) => setActiveSubTab(id as SubTabId)}
        tabs={SUB_TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
      />

      {/* Sub-tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'insights' && <InsightFeed />}
          {activeSubTab === 'correlations' && <CorrelationExplorer />}
          {activeSubTab === 'predictions' && <PredictionTracker />}
          {activeSubTab === 'reports' && <ReportViewer />}
          {activeSubTab === 'health-score' && <HealthScoreBreakdown />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
