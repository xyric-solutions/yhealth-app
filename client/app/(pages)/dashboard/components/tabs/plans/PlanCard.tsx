'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChevronRight,
  Play,
  Pause,
  Archive,
  CheckCircle2,
  Clock,
  TrendingUp,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import type { Plan, PlanStatus } from './types';
import { statusConfig, pillarConfig, goalCategoryLabels } from './constants';

interface PlanCardProps {
  plan: Plan;
  onStatusChange: (planId: string, newStatus: PlanStatus) => void;
  onDelete?: (planId: string) => void;
  isUpdating: boolean;
}

export function PlanCard({ plan, onStatusChange, onDelete, isUpdating }: PlanCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const status = statusConfig[plan.status];
  const pillar = pillarConfig[plan.pillar];
  const progress = plan.overallProgress || 0;
  const weeksRemaining = plan.durationWeeks - plan.currentWeek;

  const startDate = new Date(plan.startDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endDate = new Date(plan.endDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="group relative bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center text-white`}
          >
            {pillar.icon}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-white/90 transition-colors">
              {plan.name}
            </h3>
            <p className="text-xs text-slate-400">
              {goalCategoryLabels[plan.goalCategory]}
            </p>
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${status.bgColor} ${status.color}`}
          >
            {status.icon}
            {status.label}
          </span>

          {/* Action Menu */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {showActions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden"
                >
                  {plan.status === 'active' && (
                    <button
                      onClick={() => {
                        onStatusChange(plan.id, 'paused');
                        setShowActions(false);
                      }}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <Pause className="w-4 h-4" />
                      Pause Plan
                    </button>
                  )}
                  {plan.status === 'paused' && (
                    <button
                      onClick={() => {
                        onStatusChange(plan.id, 'active');
                        setShowActions(false);
                      }}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      Resume Plan
                    </button>
                  )}
                  {(plan.status === 'active' || plan.status === 'paused') && (
                    <button
                      onClick={() => {
                        onStatusChange(plan.id, 'completed');
                        setShowActions(false);
                      }}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Complete
                    </button>
                  )}
                  {plan.status !== 'archived' && (
                    <button
                      onClick={() => {
                        onStatusChange(plan.id, 'archived');
                        setShowActions(false);
                      }}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      <Archive className="w-4 h-4" />
                      Archive
                    </button>
                  )}
                  {plan.status === 'archived' && (
                    <>
                      <button
                        onClick={() => {
                          onStatusChange(plan.id, 'active');
                          setShowActions(false);
                        }}
                        disabled={isUpdating}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        Restore Plan
                      </button>
                      <button
                        onClick={() => {
                          onStatusChange(plan.id, 'completed');
                          setShowActions(false);
                        }}
                        disabled={isUpdating}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark Complete
                      </button>
                    </>
                  )}
                  {/* Delete option - available for all plans */}
                  {onDelete && (
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowActions(false);
                      }}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 border-t border-white/10"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Plan
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Description */}
      {plan.description && (
        <p className="text-sm text-slate-400 mb-4 line-clamp-2">{plan.description}</p>
      )}

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Progress</span>
          <span className="text-xs font-medium text-white">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${pillar.gradient} rounded-full`}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {startDate} - {endDate}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Week {plan.currentWeek} of {plan.durationWeeks}
          </span>
        </div>
        {plan.status === 'active' && weeksRemaining > 0 && (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{weeksRemaining} weeks left</span>
          </div>
        )}
      </div>

      {/* View Details Link */}
      <Link
        href="/dashboard?tab=plans"
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors"
      >
        View Details
        <ChevronRight className="w-4 h-4" />
      </Link>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Delete Plan</h3>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                Are you sure you want to delete &quot;{plan.name}&quot;? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete?.(plan.id);
                    setShowDeleteConfirm(false);
                  }}
                  disabled={isUpdating}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {isUpdating ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
