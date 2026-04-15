'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  TrendingUp,
  Heart,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import type { Goal } from '@/src/types';
import { GoalEditForm } from './GoalEditForm';
import { ConfidenceSlider } from './ConfidenceSlider';

interface GoalCardProps {
  goal: Goal;
  index: number;
  isConfirmed: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  confidence: number;
  editedValues: Partial<Goal> | undefined;
  onToggle: () => void;
  onExpand: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (field: string, value: number | string) => void;
  onTimelineChange: (weeks: number) => void;
  onConfidenceChange: (value: number) => void;
}

export function GoalCard({
  goal,
  index,
  isConfirmed,
  isExpanded,
  isEditing,
  confidence,
  editedValues,
  onToggle,
  onExpand,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
  onTimelineChange,
  onConfidenceChange,
}: GoalCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index }}
      className={`
        rounded-2xl border backdrop-blur-sm overflow-hidden
        transition-all duration-300
        ${
          isConfirmed
            ? 'border-emerald-600 border-[1.5px]'
            : 'bg-[#02000f] border-white/[0.24]'
        }
      `}
      style={isConfirmed ? { backgroundImage: 'linear-gradient(178deg, rgba(5,150,105,0) 3%, rgba(5,150,105,0.3) 99%)' } : undefined}
    >
      {/* Goal Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <GoalCheckbox isConfirmed={isConfirmed} onToggle={onToggle} />

          {/* Goal Info */}
          <div className="flex-1">
            <GoalBadges goal={goal} />
            <h3 className="text-lg font-semibold text-white mb-1">{goal.title}</h3>
            <p className="text-sm text-slate-400">{goal.description}</p>
            <GoalQuickStats goal={goal} />
          </div>

          {/* Action Buttons */}
          <GoalActions
            isEditing={isEditing}
            isExpanded={isExpanded}
            onStartEdit={onStartEdit}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onExpand={onExpand}
          />
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0 border-t border-white/10">
              {/* Edit Mode Controls */}
              {isEditing && (
                <GoalEditForm
                  goal={goal}
                  editedValues={editedValues}
                  onEditChange={onEditChange}
                  onTimelineChange={onTimelineChange}
                />
              )}

              {/* View Mode - Motivation */}
              {!isEditing && (
                <div className="mt-4 p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-pink-400" />
                    <span className="text-sm font-medium text-white">Why this matters</span>
                  </div>
                  <p className="text-sm text-slate-400">{goal.motivation}</p>
                </div>
              )}

              {/* Confidence Slider */}
              {isConfirmed && (
                <ConfidenceSlider value={confidence} onChange={onConfidenceChange} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function GoalCheckbox({
  isConfirmed,
  onToggle,
}: {
  isConfirmed: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      type="button"
      className={`
        w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center
        border-2 transition-all duration-200 mt-1
        ${
          isConfirmed
            ? 'bg-emerald-600 border-emerald-600'
            : 'border-slate-600 hover:border-slate-500'
        }
      `}
      whileTap={{ scale: 0.9 }}
    >
      {isConfirmed && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
}

function GoalBadges({ goal }: { goal: Goal }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      {goal.isPrimary && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-600/20 text-sky-400">
          Primary
        </span>
      )}
      {goal.aiSuggested && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
          AI Suggested
        </span>
      )}
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 capitalize">
        {goal.pillar}
      </span>
    </div>
  );
}

function GoalQuickStats({ goal }: { goal: Goal }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
      <div className="flex items-center gap-1 text-slate-400">
        <Calendar className="w-4 h-4" />
        <span>{goal.timeline.durationWeeks} weeks</span>
      </div>
      <div className="flex items-center gap-1 text-slate-400">
        <TrendingUp className="w-4 h-4" />
        <span>
          {goal.targetValue} {goal.targetUnit}
        </span>
      </div>
    </div>
  );
}

function GoalActions({
  isEditing,
  isExpanded,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onExpand,
}: {
  isEditing: boolean;
  isExpanded: boolean;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onExpand: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {isEditing ? (
        <>
          <button
            onClick={onSaveEdit}
            className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
            title="Save changes"
          >
            <Save className="w-4 h-4 text-emerald-400" />
          </button>
          <button
            onClick={onCancelEdit}
            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4 text-red-400" />
          </button>
        </>
      ) : (
        <button
          onClick={onStartEdit}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Edit goal"
        >
          <Edit3 className="w-4 h-4 text-slate-400" />
        </button>
      )}
      <button
        onClick={onExpand}
        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
    </div>
  );
}
