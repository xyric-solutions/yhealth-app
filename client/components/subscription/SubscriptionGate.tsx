'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Lock, Sparkles, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptionAccessContext } from '@/app/context/SubscriptionAccessContext';

/**
 * Renders a full-screen paywall overlay when user has no access (trial expired, not subscribed).
 * Shows a modern card with CTA to subscribe. Use inside a blurred container.
 */
export function SubscriptionPaywallOverlay() {
  const { isExpired, isLoading } = useSubscriptionAccessContext();

  if (isLoading || !isExpired) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop - subtle so blur from parent shows through */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md rounded-3xl border border-slate-700/60 bg-slate-900/95 p-8 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl"
      >
        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 ring-2 ring-white/20">
            <Lock className="h-10 w-10 text-white" />
          </div>
        </div>
        <div className="pt-10 text-center">
          <h2 className="text-xl font-bold text-white">Your free trial has ended</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Subscribe to unlock your dashboard and all features. Your data stays private and secure.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>High-level privacy · Cancel anytime</span>
            </div>
            <Link href="/plans">
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-6 text-base font-semibold shadow-lg shadow-indigo-500/25 transition hover:from-blue-500 hover:to-indigo-500 hover:shadow-indigo-500/30"
                size="lg"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                View plans & subscribe
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Small banner for trial users: "X days left in free trial"
 */
export function TrialBanner() {
  const { isTrial, daysLeftInTrial, isLoading } = useSubscriptionAccessContext();

  if (isLoading || !isTrial) return null;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">
          <span className="text-blue-300">{daysLeftInTrial} day{daysLeftInTrial !== 1 ? 's' : ''} left</span> in your free trial
        </p>
        <Link href="/plans">
          <Button variant="outline" size="sm" className="border-blue-400/50 text-blue-300 hover:bg-blue-500/20">
            Subscribe to keep access
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
