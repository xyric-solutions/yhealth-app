'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { useLifeAreas } from './hooks/use-life-areas';
import { LifeAreaGrid } from './components/LifeAreaGrid';
import { CreateLifeAreaModal } from './components/CreateLifeAreaModal';
import { LifeAreaDetailDrawer } from './components/LifeAreaDetailDrawer';
import { EmptyState } from './components/EmptyState';
import type { LifeArea } from './types';

export default function LifeAreasPageContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { areas, domains, isLoading, error, create, update, archive, getDetail, refresh } = useLifeAreas();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<LifeArea | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/signin?callbackUrl=/life-areas');
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-950 overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="mb-8 flex items-start justify-between gap-4"
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-slate-300 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Universal self-improvement
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              Your Life Areas
            </h1>
            <p className="mt-2 text-slate-400 max-w-xl">
              Everything you&rsquo;re working on, in one place. The coach listens, schedules, follows up —
              for anything you want to improve.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white
                       bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500
                       shadow-lg shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            New Area
          </button>
        </motion.div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {areas.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <LifeAreaGrid areas={areas} onSelect={setSelected} />
        )}
      </div>

      <CreateLifeAreaModal
        open={createOpen}
        domains={domains}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          await create(input);
          setCreateOpen(false);
        }}
      />

      <LifeAreaDetailDrawer
        area={selected}
        onClose={() => setSelected(null)}
        onUpdate={update}
        onArchive={async (id) => { await archive(id); setSelected(null); }}
        getDetail={getDetail}
        refresh={refresh}
      />
    </div>
  );
}
