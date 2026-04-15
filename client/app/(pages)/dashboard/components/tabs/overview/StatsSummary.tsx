'use client';

import { Trophy } from 'lucide-react';
import type { DashboardStats } from './types';

interface StatsSummaryProps {
  dashboardStats: DashboardStats;
}

export function StatsSummary({ dashboardStats }: StatsSummaryProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="font-semibold text-white">Your Stats</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Total Activities</span>
          <span className="text-white font-medium">
            {dashboardStats.summary.totalActivitiesCompleted}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Active Goals</span>
          <span className="text-white font-medium">
            {dashboardStats.summary.activeGoals}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Longest Streak</span>
          <span className="text-white font-medium">
            {dashboardStats.streak.longest} days
          </span>
        </div>
      </div>
    </div>
  );
}
