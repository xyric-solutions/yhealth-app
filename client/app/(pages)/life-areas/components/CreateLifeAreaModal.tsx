'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { DomainPicker } from './DomainPicker';
import type { LifeAreaDomain } from '../types';

interface Props {
  open: boolean;
  domains: LifeAreaDomain[];
  onClose: () => void;
  onCreate: (input: { slug: string; display_name: string; domain_type: string }) => Promise<void>;
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64);
}

export function CreateLifeAreaModal({ open, domains, onClose, onCreate }: Props) {
  const [domainType, setDomainType] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setDomainType(null); setName(''); setError(null); setSubmitting(false); }
  }, [open]);

  useEffect(() => {
    if (domainType && !name) {
      const d = domains.find((x) => x.type === domainType);
      if (d) setName(d.displayName);
    }
  }, [domainType, domains, name]);

  async function submit() {
    if (!domainType || !name.trim()) { setError('Pick a category and enter a name'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ slug: slugify(name) || `area-${Date.now().toString(36)}`, display_name: name.trim(), domain_type: domainType });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl"
          >
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-semibold text-white">New life area</h2>
            <p className="text-sm text-slate-400 mt-1">Pick a category and name what you&rsquo;re working on.</p>

            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Category</div>
              <DomainPicker domains={domains} value={domainType} onChange={setDomainType} />
            </div>

            <div className="mt-5">
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Job Hunt 2026"
                className="w-full rounded-lg bg-slate-950/50 border border-white/10 px-3 py-2 text-white placeholder:text-slate-500
                           focus:outline-none focus:border-blue-400/60"
              />
            </div>

            {error && <div className="mt-4 text-sm text-red-300">{error}</div>}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || !domainType || !name.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white
                           bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500
                           disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
              >
                {submitting ? 'Creating…' : 'Create area'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
