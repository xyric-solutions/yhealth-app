'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Check, Pause, Archive, Clock, Loader2, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api-client';

type Tier = 1 | 2 | 3;
type Response = 'committed' | 'paused' | 'archived' | 'snoozed';

interface Reconnection {
  id: string;
  lifeGoalId: string;
  goalTitle: string;
  daysSilent: number;
  tier: Tier;
}

interface ListResponse {
  reconnections: Reconnection[];
}

const TIER_HEADLINES: Record<Tier, string> = {
  1: 'Still on your mind?',
  2: 'Still yours?',
  3: 'Let\u2019s be honest \u2014 is this alive?',
};

const SNOOZE_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
];

type PanelMode = null | 'checkin' | 'snooze';

export function ReconnectionCard() {
  const [items, setItems] = useState<Reconnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Record<string, PanelMode>>({});
  const [mood, setMood] = useState<Record<string, number>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const resp = await api.get<ListResponse>('/reconnections');
      setItems(resp.data?.reconnections ?? []);
    } catch (err) {
      console.error('[ReconnectionCard] load failed', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const removeLocal = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  const respond = async (
    id: string,
    response: Response,
    extra: { snoozeDays?: number; checkinNote?: string; moodAboutGoal?: number } = {},
  ) => {
    setBusyId(id);
    try {
      await api.post(`/reconnections/${id}/respond`, { response, ...extra });
      removeLocal(id);
    } catch (err) {
      console.error('[ReconnectionCard] respond failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm('Archive this goal? It will be moved out of your active list.')) return;
    await respond(id, 'archived');
  };

  if (loading || items.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {items.map((r) => {
          const mode = panel[r.id] ?? null;
          const busy = busyId === r.id;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="rounded-2xl p-5 relative"
              style={{
                background:
                  'linear-gradient(145deg, rgba(99, 102, 241, 0.08) 0%, rgba(56, 189, 248, 0.06) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.22)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'rgba(99, 102, 241, 0.14)',
                    border: '1px solid rgba(99, 102, 241, 0.28)',
                  }}
                >
                  <Compass className="w-5 h-5 text-indigo-300" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 mb-1">
                    {TIER_HEADLINES[r.tier]}
                  </div>
                  <div className="text-sm font-semibold text-white mb-1 truncate">
                    {r.goalTitle}
                  </div>
                  <div className="text-xs text-white/60 mb-3">
                    {r.daysSilent} days since you last engaged with this goal.
                  </div>

                  {mode === null && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPanel((p) => ({ ...p, [r.id]: 'checkin' }))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(90deg, #6366f1 0%, #38bdf8 100%)' }}
                      >
                        <Check className="w-3.5 h-3.5" /> Still committed
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respond(r.id, 'paused')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 border border-white/[0.12] hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleArchive(r.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 border border-white/[0.12] hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPanel((p) => ({ ...p, [r.id]: 'snooze' }))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 border border-white/[0.12] hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        <Clock className="w-3.5 h-3.5" /> Snooze
                      </button>
                      {busy && <Loader2 className="w-4 h-4 animate-spin text-white/60 ml-1" />}
                    </div>
                  )}

                  {mode === 'checkin' && (
                    <div className="space-y-3 rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">
                          How are you feeling about it?
                        </div>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = (mood[r.id] ?? 0) === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setMood((m) => ({ ...m, [r.id]: n }))}
                                aria-label={`Mood ${n}`}
                                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                                  selected
                                    ? 'text-white'
                                    : 'text-white/60 bg-white/[0.04] hover:bg-white/[0.08]'
                                }`}
                                style={
                                  selected
                                    ? {
                                        background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
                                      }
                                    : undefined
                                }
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <textarea
                        value={note[r.id] ?? ''}
                        onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                        placeholder="Optional note — what's your next small step?"
                        rows={2}
                        className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            respond(r.id, 'committed', {
                              checkinNote: (note[r.id] ?? '').trim() || undefined,
                              moodAboutGoal: mood[r.id] ?? undefined,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                          style={{ background: 'linear-gradient(90deg, #6366f1 0%, #38bdf8 100%)' }}
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                          Save check-in
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setPanel((p) => ({ ...p, [r.id]: null }))}
                          className="text-xs text-white/50 hover:text-white/70 px-2 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'snooze' && (
                    <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2">
                        Remind me in…
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {SNOOZE_OPTIONS.map((opt) => (
                          <button
                            key={opt.days}
                            type="button"
                            disabled={busy}
                            onClick={() => respond(r.id, 'snoozed', { snoozeDays: opt.days })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 border border-white/[0.12] hover:bg-white/[0.04] disabled:opacity-50"
                          >
                            <Clock className="w-3.5 h-3.5" /> {opt.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setPanel((p) => ({ ...p, [r.id]: null }))}
                          className="text-xs text-white/50 hover:text-white/70 px-2 py-1.5"
                        >
                          Cancel
                        </button>
                        {busy && <Loader2 className="w-4 h-4 animate-spin text-white/60" />}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ReconnectionCard;
