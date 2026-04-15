/**
 * @file VoiceJournalSummary Component
 * @description Review screen with mood, themes, lessons, and editable journal text
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Pencil, Lightbulb, Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceJournalSummary as SummaryType } from "@shared/types/domain/wellbeing";

interface VoiceJournalSummaryProps {
  summary: SummaryType;
  isSaving: boolean;
  onApprove: (editedText?: string) => void;
  onDiscard: () => void;
}

export function VoiceJournalSummaryView({
  summary,
  isSaving,
  onApprove,
  onDiscard,
}: VoiceJournalSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(summary.journalText);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Mood badge */}
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 capitalize">
          {summary.mood}
        </span>
        <span className="text-xs text-slate-500">Detected mood</span>
      </div>

      {/* Theme tags */}
      {summary.themes.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Themes</span>
          <div className="flex flex-wrap gap-1.5">
            {summary.themes.map((theme) => (
              <span
                key={theme}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 border border-white/10 capitalize"
              >
                {theme.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lessons */}
      {summary.lessons.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Lightbulb className="w-3 h-3" />
            <span className="uppercase tracking-wider">Lessons</span>
          </div>
          <ul className="space-y-1.5">
            {summary.lessons.map((lesson, i) => (
              <li key={i} className="text-sm text-slate-300 pl-4 border-l-2 border-amber-500/30">
                {lesson}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action items */}
      {summary.actionItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Target className="w-3 h-3" />
            <span className="uppercase tracking-wider">Action Items</span>
          </div>
          <ul className="space-y-1.5">
            {summary.actionItems.map((item, i) => (
              <li key={i} className="text-sm text-slate-300 pl-4 border-l-2 border-emerald-500/30">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Journal text */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Journal Entry</span>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            {isEditing ? "Preview" : "Edit"}
          </button>
        </div>

        {isEditing ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-slate-200 leading-relaxed resize-none focus:outline-none focus:border-emerald-500/50"
          />
        ) : (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {editedText}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={onDiscard}
          disabled={isSaving}
          className="text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4 mr-1" />
          Discard
        </Button>
        <Button
          onClick={() => onApprove(editedText !== summary.journalText ? editedText : undefined)}
          disabled={isSaving}
          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save to Journal
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
