'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/context/AuthContext';
import { api, ApiError } from '@/lib/api-client';
import { Check, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function SubscriptionSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [planName, setPlanName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');
  const goToManagement = useCallback(() => {
    router.push('/subscription?refreshed=1');
  }, [router]);

  const refetchAndSetPlanName = useCallback(async () => {
    try {
      const res = await api.get<{ subscription?: { plan?: { name: string } } }>('/subscription/me');
      if (res.data?.subscription?.plan?.name) setPlanName(res.data.subscription.plan.name);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent('/subscription/success?' + searchParams.toString())}`);
      return;
    }
    if (!sessionId) {
      router.replace('/subscription');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post('/subscription/verify-session', { session_id: sessionId });
        if (cancelled) return;
        setStatus('success');
        setErrorMessage(null);
        await refetchAndSetPlanName();
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : 'Verification failed. Please try again or contact support.'));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, isAuthenticated, router, searchParams, refetchAndSetPlanName]);

  // Auto-redirect to subscription management after success
  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(goToManagement, 4000);
    return () => clearTimeout(t);
  }, [status, goToManagement]);

  if (!isAuthenticated || !sessionId) {
    return (
      <MainLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="relative min-h-[85vh] overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950/30 to-sky-950/40" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%2310b981\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M20 20.5V18H0v-2h20v-2h20v2H20v2.5z\'/%3E%3C/g%3E%3C/svg%3E')]" />
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex min-h-[85vh] flex-col items-center justify-center px-6 py-16">
          <AnimatePresence mode="wait">
            {status === 'verifying' && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-8 text-center"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/5">
                  <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white md:text-3xl">Confirming your payment</h1>
                  <p className="mt-2 text-slate-400">Please wait while we activate your subscription...</p>
                </div>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="flex max-w-lg flex-col items-center gap-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 shadow-2xl shadow-emerald-500/30 ring-4 ring-emerald-500/20"
                >
                  <Check className="h-14 w-14 text-white" strokeWidth={2.5} />
                </motion.div>
                <div className="space-y-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5"
                  >
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">Payment successful</span>
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="text-3xl font-bold tracking-tight text-white md:text-4xl"
                  >
                    You&apos;re all set!
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-slate-400"
                  >
                    {planName ? (
                      <>Your <span className="font-semibold text-emerald-400">{planName}</span> plan is now active.</>
                    ) : (
                      'Your subscription is now active.'
                    )}
                  </motion.p>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <Button
                    size="lg"
                    onClick={goToManagement}
                    className="bg-gradient-to-r from-emerald-600 to-sky-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-500 hover:to-sky-500"
                  >
                    View subscription
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="lg" asChild className="border-slate-600 bg-slate-800/50">
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-xs text-slate-500"
                >
                  Redirecting to subscription management in 4 seconds...
                </motion.p>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-6 text-center"
              >
                <div className="rounded-full border border-amber-500/30 bg-amber-500/10 p-6">
                  <span className="text-4xl font-bold text-amber-400">!</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Something went wrong</h1>
                  <p className="mt-2 text-slate-400">
                    {errorMessage ?? "We couldn't confirm your payment. Your card may not have been charged."}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/subscription">Back to subscription</Link>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
}

export default function SubscriptionSuccessPageContent() {
  return (
    <Suspense
      fallback={
        <MainLayout>
          <div className="flex min-h-[85vh] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
          </div>
        </MainLayout>
      }
    >
      <SubscriptionSuccessContent />
    </Suspense>
  );
}
