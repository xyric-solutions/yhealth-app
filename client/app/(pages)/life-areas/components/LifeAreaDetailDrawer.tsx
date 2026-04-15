'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Archive, Link2 } from 'lucide-react';
import type { LifeArea, LifeAreaLink } from '../types';

interface Props {
  area: LifeArea | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<LifeArea>) => Promise<LifeArea>;
  onArchive: (id: string) => Promise<void>;
  getDetail: (id: string) => Promise<{ area: LifeArea; links: LifeAreaLink[] }>;
  refresh: () => Promise<void>;
}

export function LifeAreaDetailDrawer({ area, onClose, onUpdate, onArchive, getDetail }: Props) {
  const [links, setLinks] = useState<LifeAreaLink[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!area) return;
    setName(area.display_name);
    void getDetail(area.id).then((d) => setLinks(d.links));
  }, [area, getDetail]);

  async function saveName() {
    if (!area || name === area.display_name) return;
    setSaving(true);
    try { await onUpdate(area.id, { display_name: name }); } finally { setSaving(false); }
  }

  return (
    <AnimatePresence>
      {area && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-900/95 border-l border-white/10 backdrop-blur-xl p-6 overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">{area.domain_type}</p>
                <h2 className="text-2xl font-semibold text-white">{area.display_name}</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  className="w-full rounded-lg bg-slate-950/50 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-blue-400/60"
                />
                {saving && <p className="text-xs text-slate-500 mt-1">Saving…</p>}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-slate-400" />
                  <span className="text-xs uppercase tracking-wider text-slate-400">Linked Items</span>
                </div>
                {links.length === 0 ? (
                  <p className="text-sm text-slate-500">No goals, schedules, or contracts linked yet. When the coach creates them under this area, they&rsquo;ll appear here.</p>
                ) : (
                  <ul className="space-y-2">
                    {links.map((l) => (
                      <li key={l.id} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
                        <span className="capitalize text-slate-400 mr-2">{l.entity_type}</span>
                        <span className="font-mono text-xs">{l.entity_id.slice(0, 8)}…</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={() => onArchive(area.id)}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/10 transition"
                >
                  <Archive className="w-4 h-4" />
                  Archive this area
                </button>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
