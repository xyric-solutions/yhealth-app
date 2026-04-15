'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/app/context/AuthContext';
import { PricingSection, type PlanItem } from '@/components/subscription/PricingSection';
import { toast } from 'react-hot-toast';

interface SubscriptionMe {
  subscription: { status: string } | null;
}

export default function PlansPageContent() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  // If user is already subscribed, redirect to subscription management
  useEffect(() => {
    if (!isAuthenticated) return;
    setCheckingSubscription(true);
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setCheckingSubscription(false);
    }, 3000);
    (async () => {
      try {
        const res = await api.get<SubscriptionMe>('/subscription/me');
        if (!cancelled && res.data?.subscription?.status === 'active') {
          router.replace('/subscription');
          return;
        }
      } catch {
        // Not subscribed or error — show plans
      } finally {
        if (!cancelled) setCheckingSubscription(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ plans: PlanItem[] }>('/subscription/plans');
        if (!cancelled && res.data?.plans) setPlans(res.data.plans);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated || !user) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent('/plans')}`);
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const successUrl = `${origin}/subscription/success`;
    const cancelUrl = `${origin}/plans`;
    setSubmittingId(planId);
    try {
      const res = await api.post<{ url: string }>('/subscription/checkout-session', {
        planId,
        successUrl,
        cancelUrl,
      });
      const url = res.data?.url;
      if (url) window.location.href = url;
      else toast.error('Could not start checkout');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Checkout failed');
    } finally {
      setSubmittingId(null);
    }
  };

  if (isAuthenticated && checkingSubscription) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Hero — emerald-600 & sky-600 gradient */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 px-6 py-24 md:py-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-90" />
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="container relative mx-auto max-w-8xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/95 backdrop-blur-sm"
          >
            Simple pricing
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-4 text-4xl font-bold tracking-tight text-white drop-shadow-lg md:text-5xl lg:text-6xl"
          >
            Choose your health journey
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mx-auto mt-5 max-w-2xl text-lg text-emerald-50/95 md:text-xl"
          >
            AI-powered insights, personalized coaching, and tools that scale with you.
          </motion.p>
        </div>
      </section>

      {/* Plans grid — elevated cards with emerald/sky accents */}
      <section className="relative px-6 py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
        <div className="container relative mx-auto max-w-8xl">
          <PricingSection
            plans={plans}
            loading={loading}
            submittingId={submittingId}
            onSubscribe={handleSubscribe}
            showBillingToggle
          />
        </div>
      </section>

      {/* Trust line */}
      <section className="border-t border-slate-800 bg-slate-900/60 px-6 py-10 backdrop-blur-sm">
        <div className="container mx-auto max-w-8xl text-center">
          <p className="text-sm text-slate-400">
            Cancel anytime · Secure payment via Stripe ·{' '}
            <a href="/contact" className="font-medium text-sky-400 hover:text-sky-300 hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </section>
    </MainLayout>
  );
}
