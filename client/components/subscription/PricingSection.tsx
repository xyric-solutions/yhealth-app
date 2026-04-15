'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PlanItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  interval: string;
  features: string[];
}

interface PricingSectionProps {
  plans: PlanItem[];
  loading?: boolean;
  submittingId: string | null;
  onSubscribe: (planId: string) => void;
  /** Show Monthly/Yearly toggle and filter plans by interval */
  showBillingToggle?: boolean;
  /** Optional class for the grid container */
  className?: string;
}

const SAVE_PERCENT_YEARLY = 20;

function getPlanIcon(slug: string) {
  if (slug === 'free') return Sparkles;
  if (slug === 'monthly' || slug === 'pro' || slug === 'pro-yearly') return Crown;
  if (slug === '3-month' || slug === 'premium') return Zap;
  return Sparkles;
}

function formatPrice(plan: PlanItem) {
  const amount = plan.amount_cents / 100;
  const cur = (plan.currency || 'usd').toUpperCase();
  if (plan.interval === 'year') {
    const perMonth = amount / 12;
    return { main: `$${perMonth.toFixed(0)}`, sub: '/mo', extra: `Billed $${amount}/year`, cur };
  }
  return { main: `$${amount.toFixed(2)}`, sub: '/mo', extra: null, cur };
}

export function PricingSection({
  plans,
  loading = false,
  submittingId,
  onSubscribe,
  showBillingToggle = true,
  className = '',
}: PricingSectionProps) {
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  const filteredPlans = useMemo(() => {
    if (!showBillingToggle) return plans;
    return plans.filter((p) => p.interval === billingInterval);
  }, [plans, showBillingToggle, billingInterval]);

  const isPopularPlan = (slug: string) =>
    slug === 'monthly' || slug === 'pro' || slug === 'pro-yearly';
  const isPro = isPopularPlan; // alias for compatibility

  if (loading) {
    return (
      <div className={`flex min-h-[320px] items-center justify-center ${className}`}>
        <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <p className={`text-center text-slate-500 ${className}`}>
        No plans available at the moment.
      </p>
    );
  }

  return (
    <div className={className}>
      {showBillingToggle && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-col items-center gap-4"
        >
          <p className="text-sm font-medium text-slate-400">Billing</p>
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-800/90 p-1.5 ring-1 ring-slate-700/80 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setBillingInterval('month')}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                billingInterval === 'month'
                  ? 'bg-gradient-to-r from-emerald-600 to-sky-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval('year')}
              className={`relative rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                billingInterval === 'year'
                  ? 'bg-gradient-to-r from-emerald-600 to-sky-600 text-white shadow-lg shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="ml-1.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                Save {SAVE_PERCENT_YEARLY}%
              </span>
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {filteredPlans.map((plan, i) => {
          const Icon = getPlanIcon(plan.slug);
          const price = formatPrice(plan);
          const popular = isPro(plan.slug);
          return (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className={`relative flex flex-col rounded-2xl border bg-slate-900/90 p-6 shadow-xl shadow-slate-950/50 backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 md:p-8 ${
                popular
                  ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-700/60 hover:border-slate-600'
              }`}
            >
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-1 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25">
                  Most Popular
                </div>
              )}
              <div className="mb-5 flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    popular
                      ? 'bg-gradient-to-br from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-700/80 text-slate-300'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                  <p className="text-xs text-slate-500">
                    {plan.interval === 'year' ? 'Billed annually' : 'Billed monthly'}
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                  {price.main}
                </span>
                <span className="text-slate-400">{price.sub}</span>
                {price.extra && (
                  <p className="mt-1 text-xs text-slate-500">{price.extra}</p>
                )}
              </div>
              {plan.description && (
                <p className="mb-5 text-sm leading-relaxed text-slate-400">
                  {plan.description}
                </p>
              )}
              <ul className="mb-8 flex-1 space-y-2.5">
                {(plan.features || []).map((feature, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => onSubscribe(plan.id)}
                disabled={!!submittingId}
                className={`w-full rounded-xl py-6 text-base font-semibold transition-all duration-200 ${
                  popular
                    ? 'bg-gradient-to-r from-emerald-600 to-sky-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-sky-500'
                    : 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600'
                }`}
              >
                {submittingId === plan.id ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : (
                  'Get started'
                )}
              </Button>
            </motion.article>
          );
        })}
      </div>

      {showBillingToggle && filteredPlans.length === 0 && (
        <p className="text-center text-slate-500">
          No {billingInterval === 'month' ? 'monthly' : 'yearly'} plans at the moment.
        </p>
      )}
    </div>
  );
}
