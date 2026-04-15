'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, MessageCircle, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface Obstacle {
  id: string;
  goalRefType: 'life_goal' | 'user_goal' | 'daily_intention';
  goalRefId: string;
  goalTitle: string;
  missCountLast7d: number;
  createdAt: string;
}

interface ListResponse {
  obstacles: Obstacle[];
}

export function ObstacleCard() {
  const router = useRouter();
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await api.get<ListResponse>('/obstacles');
      setObstacles(resp.data?.obstacles ?? []);
    } catch (err) {
      console.error('[ObstacleCard] load failed', err);
      setObstacles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = (obstacle: Obstacle) => {
    router.push(`/obstacles/${obstacle.id}`);
  };

  const handleDismiss = async (obstacleId: string) => {
    setDismissingId(obstacleId);
    try {
      await api.post(`/obstacles/${obstacleId}/dismiss`);
      setObstacles((prev) => prev.filter((o) => o.id !== obstacleId));
    } catch (err) {
      console.error('[ObstacleCard] dismiss failed', err);
    } finally {
      setDismissingId(null);
    }
  };

  if (loading || obstacles.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {obstacles.map((o) => (
          <motion.div
            key={o.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl p-5 relative"
            style={{
              background:
                'linear-gradient(145deg, rgba(251, 146, 60, 0.08) 0%, rgba(236, 72, 153, 0.06) 100%)',
              border: '1px solid rgba(251, 146, 60, 0.22)',
            }}
          >
            <button
              type="button"
              onClick={() => handleDismiss(o.id)}
              disabled={dismissingId === o.id}
              aria-label="Dismiss"
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              {dismissingId === o.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-white/60" />
              ) : (
                <X className="w-4 h-4 text-white/60" />
              )}
            </button>

            <div className="flex items-start gap-3 pr-8">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(251, 146, 60, 0.14)',
                  border: '1px solid rgba(251, 146, 60, 0.28)',
                }}
              >
                <AlertCircle className="w-5 h-5 text-orange-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium uppercase tracking-wider text-orange-400 mb-1">
                  Let&apos;s figure this out
                </div>
                <div className="text-sm font-semibold text-white mb-1 truncate">
                  {o.goalTitle}
                </div>
                <div className="text-xs text-white/60 mb-3">
                  Missed {o.missCountLast7d} times in the last 7 days. What&apos;s really blocking you?
                </div>

                <button
                  type="button"
                  onClick={() => handleOpen(o)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
                  style={{
                    background: 'linear-gradient(90deg, #fb923c 0%, #ec4899 100%)',
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Start the conversation
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ObstacleCard;
