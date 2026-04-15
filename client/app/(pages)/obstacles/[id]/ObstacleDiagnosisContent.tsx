'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api-client';
import { AdjustmentSuggestionCard } from '@/app/(pages)/chat/components/AdjustmentSuggestionCard';

interface Obstacle {
  id: string;
  goalTitle: string;
  goalRefType: 'life_goal' | 'user_goal' | 'daily_intention';
  missCountLast7d: number;
  category: string | null;
  aiNotes: string | null;
  suggestedAdjustment: {
    kind: 'reschedule' | 'reduce_frequency' | 'change_location' | 'add_preparation_intention' | 'no_change';
    payload: Record<string, unknown>;
  } | null;
  resolvedAt: string | null;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  adjustmentReady?: boolean;
}

interface DiagnoseResponse {
  reply: string;
  block: {
    category: string;
    aiNotes: string;
    suggestedAdjustment: Obstacle['suggestedAdjustment'];
  } | null;
}

export default function ObstacleDiagnosisContent({ obstacleId }: { obstacleId: string }) {
  const router = useRouter();
  const [obstacle, setObstacle] = useState<Obstacle | null>(null);
  const [loading, setLoading] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const runTurn = useCallback(
    async (nextTranscript: Turn[]) => {
      setSending(true);
      setError(null);
      try {
        const resp = await api.post<DiagnoseResponse>(
          `/obstacles/${obstacleId}/diagnose`,
          {
            transcript: nextTranscript.map((t) => ({ role: t.role, content: t.content })),
          },
        );
        const data = resp.data;
        if (!data) throw new Error('Empty response');

        const assistantTurn: Turn = {
          role: 'assistant',
          content: data.reply,
          adjustmentReady: Boolean(data.block),
        };
        setTurns((prev) => [...prev, assistantTurn]);

        if (data.block) {
          setObstacle((prev) =>
            prev
              ? {
                  ...prev,
                  category: data.block!.category,
                  aiNotes: data.block!.aiNotes,
                  suggestedAdjustment: data.block!.suggestedAdjustment,
                }
              : prev,
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setSending(false);
      }
    },
    [obstacleId],
  );

  // Load obstacle + auto-kick first coach turn
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get<{ obstacle: Obstacle }>(`/obstacles/${obstacleId}`);
        if (cancelled) return;
        const ob = resp.data?.obstacle;
        if (!ob) throw new Error('Obstacle not found');
        setObstacle(ob);
        setLoading(false);

        // If already has a suggested adjustment, skip auto-kicking — user came back to resolve it
        if (!ob.suggestedAdjustment) {
          await runTurn([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load obstacle');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [obstacleId, runTurn]);

  // Auto-scroll on new turns
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userTurn: Turn = { role: 'user', content: text };
    const next = [...turns, userTurn];
    setTurns(next);
    setInput('');
    await runTurn(next);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-950 text-white/60">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!obstacle) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-950 text-white/70 p-6">
        <div className="text-sm mb-4">{error ?? 'Obstacle not found.'}</div>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const awaitingDecision = Boolean(obstacle.suggestedAdjustment) && !obstacle.resolvedAt;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-950">
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-white/[0.06] backdrop-blur-xl"
        style={{ background: 'rgba(10, 10, 20, 0.85)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            aria-label="Back"
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-indigo-300 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Obstacle diagnosis
            </div>
            <div className="text-sm font-semibold text-white truncate">{obstacle.goalTitle}</div>
          </div>
        </div>
      </header>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="text-xs text-white/40 text-center mb-2">
            Missed {obstacle.missCountLast7d} times in the last 7 days
          </div>

          <AnimatePresence initial={false}>
            {turns.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    t.role === 'user'
                      ? 'text-white'
                      : 'text-white/90 border border-white/[0.08]'
                  }`}
                  style={
                    t.role === 'user'
                      ? { background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)' }
                      : { background: 'rgba(255,255,255,0.04)' }
                  }
                >
                  {t.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 bg-white/[0.04] border border-white/[0.08]">
                <Loader2 className="w-4 h-4 animate-spin text-white/40" />
              </div>
            </div>
          )}

          {awaitingDecision && obstacle.suggestedAdjustment && (
            <AdjustmentSuggestionCard
              obstacleId={obstacle.id}
              goalTitle={obstacle.goalTitle}
              adjustment={obstacle.suggestedAdjustment}
              onResolved={(resp) => {
                setObstacle((prev) => (prev ? { ...prev, resolvedAt: new Date().toISOString() } : prev));
                if (resp === 'accepted') {
                  setTimeout(() => router.push('/dashboard'), 1200);
                }
              }}
            />
          )}

          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      </div>

      {/* Composer — hidden after resolution */}
      {!obstacle.resolvedAt && !awaitingDecision && (
        <div className="border-t border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your answer…"
              rows={1}
              className="flex-1 resize-none rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50"
              style={{ maxHeight: 120 }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              aria-label="Send"
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)' }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
