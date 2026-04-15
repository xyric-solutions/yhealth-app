'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Inbox } from 'lucide-react';
import { lifeGoalsService } from '@/src/shared/services/wellbeing.service';
import { AISuggestionCard } from '@/components/common/AISuggestionCard';
import type { LifeGoal, GoalAction } from '@shared/types/domain/wellbeing';

// ============================================
// TYPES
// ============================================

interface ActionWithGoal extends GoalAction {
  goalTitle: string;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_SUGGESTIONS = 3;

// ============================================
// COMPONENT
// ============================================

export function DailySuggestionsWidget() {
  const [actions, setActions] = useState<ActionWithGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const goalsRes = await lifeGoalsService.getGoals({ status: 'active' });
      const goals: LifeGoal[] = goalsRes.data?.goals ?? [];

      if (goals.length === 0) {
        setActions([]);
        return;
      }

      // Fetch pending actions for top goals (limit to first 3 to avoid excessive requests)
      const topGoals = goals.slice(0, MAX_SUGGESTIONS);
      const actionResults = await Promise.all(
        topGoals.map(async (goal) => {
          try {
            const res = await lifeGoalsService.getGoalActions(goal.id);
            const goalActions = res.data?.actions ?? [];
            return goalActions
              .filter((a) => !a.isCompleted)
              .slice(0, 1) // Take one pending action per goal
              .map((a) => ({ ...a, goalTitle: goal.title }));
          } catch {
            return [];
          }
        }),
      );

      setActions(actionResults.flat().slice(0, MAX_SUGGESTIONS));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleAccept = useCallback(
    async (action: ActionWithGoal) => {
      setRespondingIds((prev) => new Set(prev).add(action.id));
      try {
        await lifeGoalsService.respondToAction(action.goalId, action.id, 'accept');
        setActions((prev) => prev.filter((a) => a.id !== action.id));
      } finally {
        setRespondingIds((prev) => {
          const next = new Set(prev);
          next.delete(action.id);
          return next;
        });
      }
    },
    [],
  );

  const handleEdit = useCallback(
    async (action: ActionWithGoal, edited: { title: string; description: string }) => {
      setRespondingIds((prev) => new Set(prev).add(action.id));
      try {
        await lifeGoalsService.respondToAction(action.goalId, action.id, 'edit', edited);
        setActions((prev) => prev.filter((a) => a.id !== action.id));
      } finally {
        setRespondingIds((prev) => {
          const next = new Set(prev);
          next.delete(action.id);
          return next;
        });
      }
    },
    [],
  );

  const handleSkip = useCallback(
    async (action: ActionWithGoal, reason?: string) => {
      setRespondingIds((prev) => new Set(prev).add(action.id));
      try {
        // Pass reason as description edit for skip tracking
        await lifeGoalsService.respondToAction(action.goalId, action.id, 'skip', reason ? { description: reason } : undefined);
        setActions((prev) => prev.filter((a) => a.id !== action.id));
      } finally {
        setRespondingIds((prev) => {
          const next = new Set(prev);
          next.delete(action.id);
          return next;
        });
      }
    },
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Today&apos;s Coaching</h3>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Loading skeleton */}
        {loading && (
          <>
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-700/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-700/50 rounded w-3/4" />
                    <div className="h-3 bg-slate-700/30 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-6">
            <p className="text-xs text-slate-500">Unable to load suggestions</p>
            <button
              type="button"
              onClick={fetchSuggestions}
              className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && actions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mb-3">
              <Inbox className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">No suggestions today</p>
            <p className="text-xs text-slate-500 mt-1">Check back later or set new goals</p>
          </div>
        )}

        {/* Suggestion cards */}
        <AnimatePresence mode="popLayout">
          {actions.map((action) => (
            <AISuggestionCard
              key={action.id}
              variant="compact"
              title={action.title}
              description={action.description}
              actionType={action.actionType}
              pillar={action.pillar}
              frequency={action.frequency}
              goalLink={{ id: action.goalId, title: action.goalTitle }}
              isLoading={respondingIds.has(action.id)}
              onAccept={() => handleAccept(action)}
              onEdit={(edited) => handleEdit(action, edited)}
              onSkip={(reason) => handleSkip(action, reason)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer link */}
      {!loading && actions.length > 0 && (
        <button
          type="button"
          className="flex items-center gap-1 mt-4 text-xs text-slate-400 hover:text-cyan-400 transition-colors group w-full justify-center"
        >
          View All Goals
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </motion.div>
  );
}
