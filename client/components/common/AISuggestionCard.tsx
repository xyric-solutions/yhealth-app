'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Pencil,
  X,
  ChevronDown,
  Repeat,
  Calendar,
  BookOpen,
  BarChart3,
  Target,
  Lightbulb,
  Link,
  Loader2,
  Save,
} from 'lucide-react';
import type { GoalActionType, HealthPillar } from '@shared/types/domain/wellbeing';

// ============================================
// TYPES
// ============================================

interface AISuggestionCardProps {
  title: string;
  description?: string;
  rationale?: string;
  actionType?: GoalActionType;
  pillar?: HealthPillar;
  frequency?: string;
  goalLink?: { id: string; title: string };
  onAccept: () => void;
  onEdit: (edited: { title: string; description: string }) => void;
  onSkip: (reason?: string) => void;
  isLoading?: boolean;
  variant?: 'card' | 'compact' | 'notification';
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const PILLAR_COLORS: Record<HealthPillar, { border: string; accent: string; bg: string }> = {
  fitness: {
    border: 'border-cyan-500/30',
    accent: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  nutrition: {
    border: 'border-emerald-500/30',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  wellbeing: {
    border: 'border-purple-500/30',
    accent: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
};

const DEFAULT_PILLAR_COLORS = {
  border: 'border-slate-700/50',
  accent: 'text-slate-400',
  bg: 'bg-slate-500/10',
};

const ACTION_TYPE_ICONS: Record<GoalActionType, typeof Repeat> = {
  habit: Repeat,
  schedule: Calendar,
  journal_prompt: BookOpen,
  tracking: BarChart3,
  milestone: Target,
  behavioral_trick: Lightbulb,
};

const SKIP_REASONS = ['Too hard', 'Not now', 'Not relevant'] as const;

// ============================================
// COMPONENT
// ============================================

export function AISuggestionCard({
  title,
  description,
  rationale,
  actionType,
  pillar,
  frequency,
  goalLink,
  onAccept,
  onEdit,
  onSkip,
  isLoading = false,
  variant = 'card',
  className = '',
}: AISuggestionCardProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'skip'>('view');
  const [showRationale, setShowRationale] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description ?? '');

  const colors = pillar ? PILLAR_COLORS[pillar] : DEFAULT_PILLAR_COLORS;
  const ActionIcon = actionType ? ACTION_TYPE_ICONS[actionType] : Lightbulb;

  const handleEdit = useCallback(() => {
    setEditTitle(title);
    setEditDescription(description ?? '');
    setMode('edit');
  }, [title, description]);

  const handleSaveEdit = useCallback(() => {
    onEdit({ title: editTitle, description: editDescription });
    setMode('view');
  }, [editTitle, editDescription, onEdit]);

  const handleSkipWithReason = useCallback(
    (reason: string) => {
      onSkip(reason);
      setMode('view');
    },
    [onSkip],
  );

  const handleQuickSkip = useCallback(() => {
    setMode('skip');
  }, []);

  const handleCancelMode = useCallback(() => {
    setMode('view');
  }, []);

  // ---- Notification variant (minimal inline) ----
  if (variant === 'notification') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        className={`flex items-center gap-3 rounded-lg bg-white/5 border ${colors.border} px-3 py-2 backdrop-blur-sm ${className}`}
      >
        <ActionIcon className={`w-4 h-4 flex-shrink-0 ${colors.accent}`} />
        <span className="text-sm text-white truncate flex-1">{title}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onAccept}
            disabled={isLoading}
            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
            aria-label="Accept suggestion"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </button>
          <button
            type="button"
            onClick={() => onSkip()}
            disabled={isLoading}
            className="p-1 rounded-md bg-slate-500/20 hover:bg-slate-500/30 transition-colors"
            aria-label="Skip suggestion"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </motion.div>
    );
  }

  const isCompact = variant === 'compact';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-2xl bg-white/5 border ${colors.border} backdrop-blur-xl ${
        isCompact ? 'p-4' : 'p-5'
      } shadow-lg ${className}`}
    >
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-2xl"
          >
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- VIEW MODE ---- */}
      <AnimatePresence mode="wait">
        {mode === 'view' && (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Header row */}
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 ${isCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl ${colors.bg} flex items-center justify-center`}
              >
                <ActionIcon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} ${colors.accent}`} />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className={`font-semibold text-white ${isCompact ? 'text-sm' : 'text-base'} leading-snug`}>
                  {title}
                </h4>

                {/* Badges row */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {actionType && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.accent} capitalize`}>
                      {actionType.replace('_', ' ')}
                    </span>
                  )}
                  {frequency && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 capitalize">
                      {frequency}
                    </span>
                  )}
                  {pillar && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.accent} capitalize`}>
                      {pillar}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {description && !isCompact && (
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">{description}</p>
            )}

            {/* Goal link chip */}
            {goalLink && !isCompact && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Link className="w-3 h-3 text-indigo-400" />
                <span className="text-xs text-indigo-300">Supports: {goalLink.title}</span>
              </div>
            )}

            {/* Rationale expandable */}
            {rationale && !isCompact && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowRationale((prev) => !prev)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                  aria-expanded={showRationale}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${showRationale ? 'rotate-180' : ''}`}
                  />
                  Why this?
                </button>
                <AnimatePresence>
                  {showRationale && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden text-xs text-slate-400 mt-1.5 leading-relaxed pl-5"
                    >
                      {rationale}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Action buttons */}
            <div className={`flex items-center gap-2 ${isCompact ? 'mt-3' : 'mt-4'}`}>
              <button
                type="button"
                onClick={onAccept}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors disabled:opacity-50"
                aria-label="Accept suggestion"
              >
                <Check className="w-3.5 h-3.5" />
                Accept
              </button>
              {!isCompact && (
                <button
                  type="button"
                  onClick={handleEdit}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-medium transition-colors disabled:opacity-50"
                  aria-label="Edit suggestion"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={isCompact ? () => onSkip() : handleQuickSkip}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 text-slate-400 text-xs font-medium transition-colors disabled:opacity-50"
                aria-label="Skip suggestion"
              >
                <X className="w-3.5 h-3.5" />
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {/* ---- EDIT MODE ---- */}
        {mode === 'edit' && (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="edit-title" className="text-xs text-slate-400 block mb-1">
                Title
              </label>
              <input
                id="edit-title"
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label htmlFor="edit-description" className="text-xs text-slate-400 block mb-1">
                Description
              </label>
              <textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editTitle.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 text-slate-400 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* ---- SKIP MODE ---- */}
        {mode === 'skip' && (
          <motion.div
            key="skip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <p className="text-sm text-slate-300">Why skip this suggestion?</p>
            <div className="flex flex-wrap gap-2">
              {SKIP_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => handleSkipWithReason(reason)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 text-xs font-medium transition-colors border border-slate-600/30"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCancelMode}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
