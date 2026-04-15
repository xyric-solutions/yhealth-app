'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2, Lightbulb } from 'lucide-react';
import { api } from '@/lib/api-client';

type AdjustmentKind =
  | 'reschedule'
  | 'reduce_frequency'
  | 'change_location'
  | 'add_preparation_intention'
  | 'no_change';

export interface AdjustmentSuggestionProps {
  obstacleId: string;
  goalTitle: string;
  adjustment: {
    kind: AdjustmentKind;
    payload: Record<string, unknown>;
  };
  onResolved?: (response: 'accepted' | 'declined') => void;
}

function formatAdjustment(kind: AdjustmentKind, payload: Record<string, unknown>): string {
  switch (kind) {
    case 'reschedule': {
      const t = payload.newTime ? ` at ${payload.newTime}` : '';
      const days = Array.isArray(payload.newDayOfWeek)
        ? ` on ${(payload.newDayOfWeek as number[])
            .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
            .join(', ')}`
        : '';
      return `Move it${t}${days}.`;
    }
    case 'reduce_frequency': {
      const v = payload.newTargetValue;
      const u = payload.newTargetUnit ? ` ${payload.newTargetUnit}` : '';
      return `Dial the target down to ${v}${u}.`;
    }
    case 'change_location':
      return `Try a new spot: ${payload.newLocation}.`;
    case 'add_preparation_intention':
      return `Add a prep step the night before: "${payload.intentionText}".`;
    case 'no_change':
      return `Keep the goal as-is — the real work is elsewhere. ${payload.reason ?? ''}`;
    default:
      return 'Proposed adjustment.';
  }
}

export function AdjustmentSuggestionCard({
  obstacleId,
  goalTitle,
  adjustment,
  onResolved,
}: AdjustmentSuggestionProps) {
  const [state, setState] = useState<'idle' | 'submitting' | 'accepted' | 'declined' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (response: 'accepted' | 'declined') => {
    setState('submitting');
    setErrorMsg(null);
    try {
      await api.post(`/obstacles/${obstacleId}/apply-adjustment`, { response });
      setState(response);
      onResolved?.(response);
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (state === 'accepted') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-4 my-2 border"
        style={{ background: 'rgba(34, 197, 94, 0.08)', borderColor: 'rgba(34, 197, 94, 0.28)' }}
      >
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <Check className="w-4 h-4" /> Applied. Your goal has been updated.
        </div>
      </motion.div>
    );
  }

  if (state === 'declined') {
    return (
      <div className="rounded-xl p-4 my-2 border border-white/[0.08] text-sm text-white/60">
        No worries — we can revisit this later.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 my-2 border"
      style={{
        background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.08) 0%, rgba(236, 72, 153, 0.06) 100%)',
        borderColor: 'rgba(99, 102, 241, 0.28)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(99, 102, 241, 0.18)' }}
        >
          <Lightbulb className="w-4 h-4 text-indigo-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 mb-1">
            Suggested adjustment
          </div>
          <div className="text-sm text-white/90 font-medium mb-1 truncate">{goalTitle}</div>
          <div className="text-sm text-white/70 mb-3">{formatAdjustment(adjustment.kind, adjustment.payload)}</div>

          {errorMsg && (
            <div className="text-xs text-red-400 mb-2">{errorMsg}</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={state === 'submitting'}
              onClick={() => submit('accepted')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)' }}
            >
              {state === 'submitting' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Accept
            </button>
            <button
              type="button"
              disabled={state === 'submitting'}
              onClick={() => submit('declined')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 border border-white/[0.12] hover:bg-white/[0.04] disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Not now
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default AdjustmentSuggestionCard;
