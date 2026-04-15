'use client';

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  ExternalLink, 
  Loader2, 
  Sparkles, 
  Download, 
  FileText,
  CheckCircle2,
  Clock,
  Calendar,
  Zap,
  Shield,
  TrendingUp,
  Star,
  Gift,
  ArrowRight,
  Sparkle,
  AlertCircle
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/app/context/AuthContext';
import { PricingSection, type PlanItem } from '@/components/subscription/PricingSection';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface SubscriptionMe {
  subscription: {
    id: string;
    status: string;
    current_period_start?: string | null;
    current_period_end: string | null;
    cancel_at_period_end?: boolean;
    plan: { id: string; name: string; slug: string; amount_cents: number; interval: string } | null;
  } | null;
  invoiceUrl?: string;
  access: { allowed: boolean; reason: string; trialEndsAt?: string; daysLeftInTrial?: number };
}

function SubscriptionTimer({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) {
  const start = useMemo(() => new Date(periodStart).getTime(), [periodStart]);
  const end = useMemo(() => new Date(periodEnd).getTime(), [periodEnd]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const total = Math.max(1, end - start);
  const elapsed = Math.min(total, Math.max(0, now - start));
  const progress = elapsed / total;
  const left = Math.max(0, end - now);
  const days = Math.floor(left / (24 * 60 * 60 * 1000));
  const hours = Math.floor((left % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((left % (60 * 1000)) / 1000);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseYSpring = useSpring(y, { stiffness: 500, damping: 100 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['17.5deg', '-17.5deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-17.5deg', '17.5deg']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = (mouseX / width - 0.5) * 2;
    const yPct = (mouseY / height - 0.5) * 2;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="flex items-center gap-8 group"
    >
      <div className="relative h-40 w-40 shrink-0" style={{ transform: 'translateZ(20px)' }}>
        <svg className="h-40 w-40 -rotate-90" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-slate-800/30"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#timerGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ type: 'tween', ease: 'linear', duration: 0.5 }}
            style={{ filter: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.6))' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: 'translateZ(10px)' }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="text-center"
          >
            <motion.span
              key={days}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-4xl font-bold bg-gradient-to-br from-emerald-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent leading-none"
              style={{
                backgroundSize: '200% 200%',
                animation: 'gradient-shift 3s ease infinite',
              }}
            >
              {days}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="block text-sm text-slate-300 font-medium mt-1"
            >
              days
            </motion.span>
          </motion.div>
        </div>
        {/* Top glowing dot */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-gradient-to-br from-emerald-400 to-sky-400"
          style={{ transform: 'translateZ(15px) translateX(-50%)' }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {/* Top-right glowing dot */}
        <motion.div
          className="absolute top-2 right-4 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400"
          style={{ transform: 'translateZ(15px)' }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.9, 0.5],
          }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
        />
      </div>
      <div className="flex flex-col gap-2" style={{ transform: 'translateZ(10px)' }}>
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <Clock className="h-4 w-4 text-sky-400" />
          </motion.div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Time left in period</p>
        </div>
        <motion.p
          key={`${days}-${hours}-${minutes}-${seconds}`}
          initial={{ scale: 1.05, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-2xl font-bold tabular-nums bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent bg-[length:200%_100%]"
          style={{
            animation: 'gradient-shift 3s ease infinite',
          }}
        >
          {String(days).padStart(2, '0')}:{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </motion.p>
        <div className="flex items-center gap-2 mt-1">
          <Calendar className="h-3.5 w-3.5 text-emerald-400" />
          <p className="text-xs text-slate-400">Renews {format(new Date(periodEnd), 'PPP')}</p>
        </div>
      </div>
      <style jsx>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </motion.div>
  );
}

function SubscriptionPageContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionMe | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [managingPortal, setManagingPortal] = useState(false);
  const [syncingFromStripe, setSyncingFromStripe] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [autoSyncing, setAutoSyncing] = useState(false);

  const refetchSubscription = useCallback(async () => {
    try {
      const res = await api.get<SubscriptionMe>('/subscription/me');
      if (res.data) setSubscriptionData(res.data as SubscriptionMe);
    } catch {
      setSubscriptionData(null);
    }
  }, []);

  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setLoadingMe(false);
      return;
    }
    setLoadingMe(true);
    try {
      const res = await api.get<SubscriptionMe>('/subscription/me');
      if (res.data) setSubscriptionData(res.data as SubscriptionMe);
      else setSubscriptionData(null);
    } catch {
      setSubscriptionData(null);
    } finally {
      setLoadingMe(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // When landing from success page (?refreshed=1), refetch so subscribed plan shows
  useEffect(() => {
    const refreshed = searchParams.get('refreshed');
    if (!refreshed || !isAuthenticated) return;
    let cancelled = false;
    refetchSubscription().then(() => {
      if (!cancelled) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('refreshed');
        const qs = params.toString();
        router.replace(qs ? `/subscription?${qs}` : '/subscription', { scroll: false });
      }
    });
    return () => { cancelled = true; };
  }, [searchParams, isAuthenticated, refetchSubscription, router]);

  // Auto-sync from Stripe once when user has no subscription (e.g. paid but success redirect missed)
  const autoSyncAttempted = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || loadingMe || autoSyncAttempted.current) return;
    const hasActive = subscriptionData?.subscription?.status === 'active';
    if (hasActive) return;
    autoSyncAttempted.current = true;
    let cancelled = false;
    setAutoSyncing(true);
    api
      .post<{ synced?: boolean }>('/subscription/sync-from-stripe')
      .then((res) => {
        if (cancelled) return;
        if (res.data?.synced) return refetchSubscription();
        return undefined;
      })
      .catch(() => {
        // Silent: user can still click "I already paid - sync my subscription"
      })
      .finally(() => {
        if (!cancelled) setAutoSyncing(false);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, loadingMe, subscriptionData?.subscription?.status, refetchSubscription]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ plans: PlanItem[] }>('/subscription/plans');
        if (!cancelled && res.data?.plans) setPlans(res.data.plans);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated || !user) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent('/subscription')}`);
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const successUrl = `${origin}/subscription/success`;
    const cancelUrl = `${origin}/subscription`;
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

  const handleManageSubscription = async () => {
    if (!isAuthenticated) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const returnUrl = `${origin}/subscription`;
    setManagingPortal(true);
    try {
      const res = await api.post<{ url: string }>('/subscription/portal-session', { returnUrl });
      const url = res.data?.url;
      if (url) window.location.href = url;
      else toast.error('Could not open billing portal');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to open portal');
    } finally {
      setManagingPortal(false);
    }
  };

  const handleSyncFromStripe = async () => {
    if (!isAuthenticated) return;
    setSyncError(null);
    setSyncingFromStripe(true);
    try {
      await api.post('/subscription/sync-from-stripe');
      await refetchSubscription();
      toast.success('Subscription synced. You’re all set!');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not sync. Try again or contact support.';
      setSyncError(msg);
      toast.error(msg);
    } finally {
      setSyncingFromStripe(false);
    }
  };

  const sub = subscriptionData?.subscription;
  const hasActive = sub && sub.status === 'active';

  return (
    <MainLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-sky-600 to-emerald-600 px-6 py-16 md:py-20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23fff\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z\'/%3E%3C/g%3E%3C/svg%3E')] opacity-100" />
        <motion.div
          className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="container relative mx-auto max-w-8xl z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left"
          >
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0, rotate: -180 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-xl ring-1 ring-white/30"
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  <CreditCard className="h-8 w-8 text-white" />
                </motion.div>
                <motion.div
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-400"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-bold tracking-tight text-white drop-shadow-lg md:text-4xl"
                >
                  Subscription
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-2 text-sm text-white/90 flex items-center gap-2"
                >
                  <Sparkle className="h-4 w-4 animate-pulse" />
                  Manage your plan and billing
                </motion.p>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="hidden md:flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 border border-white/20"
            >
              <Shield className="h-4 w-4 text-white animate-pulse" />
              <span className="text-xs text-white/90 font-medium">Secure Payment</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto max-w-8xl px-6 py-10">
        {/* Current subscription card */}
        {isAuthenticated && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            {loadingMe ? (
              <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/40">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : hasActive && sub?.plan ? (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80 p-6 shadow-2xl backdrop-blur-xl md:p-8"
                style={{ perspective: '1000px' }}
              >
                {/* Animated gradient border */}
                <motion.div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.3) 50%, transparent)',
                    backgroundSize: '200% 100%',
                    backgroundPositionX: '100%',
                    padding: '1px',
                  }}
                  animate={{ backgroundPositionX: ['100%', '-100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
                
                {/* Inner glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />

                <div className="relative z-10 flex flex-col gap-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 backdrop-blur-sm border border-emerald-500/30"
                      >
                        <motion.div
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                        >
                          <Zap className="h-7 w-7 text-emerald-400" />
                        </motion.div>
                        <motion.div
                          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400"
                          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </motion.div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <Star className="h-3 w-3 text-emerald-400 animate-pulse" />
                            Current plan
                          </p>
                        </div>
                        <motion.h2
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                          className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent"
                        >
                          {sub.plan.name}
                        </motion.h2>
                        <div className="flex items-center gap-2 mt-2">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                          >
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                          </motion.div>
                          <p className="text-base font-semibold text-white">
                            ${(sub.plan.amount_cents / 100).toFixed(2)} USD
                          </p>
                          <span className="text-sm text-slate-400">/ {sub.plan.interval === 'year' ? 'year' : 'month'}</span>
                        </div>
                        {sub.cancel_at_period_end && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5"
                          >
                            <motion.div
                              animate={{ rotate: [0, 360] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            >
                              <Clock className="h-3.5 w-3.5 text-amber-400" />
                            </motion.div>
                            <p className="text-amber-400 text-xs font-medium">Cancels at end of period</p>
                          </motion.div>
                        )}
                        {sub.current_period_end && (
                          <div className="flex items-center gap-2 mt-3">
                            <Calendar className="h-3.5 w-3.5 text-sky-400" />
                            <p className="text-xs text-slate-400">
                              Next billing: <span className="text-sky-400 font-medium">{format(new Date(sub.current_period_end), 'PPP')}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          onClick={handleManageSubscription}
                          disabled={managingPortal}
                          className="bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white shadow-lg shadow-emerald-500/25 transition-all duration-300"
                        >
                          {managingPortal ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <motion.div
                              animate={{ x: [0, 4, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                            </motion.div>
                          )}
                          Manage subscription
                        </Button>
                      </motion.div>
                      {subscriptionData?.invoiceUrl && (
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            variant="outline"
                            className="border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-emerald-500/50 transition-all"
                            onClick={() => window.open(subscriptionData.invoiceUrl!, '_blank', 'noopener')}
                          >
                            <motion.div
                              animate={{ rotate: [0, 360] }}
                              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                            >
                              <Download className="mr-2 h-4 w-4" />
                            </motion.div>
                            Download invoice
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                  {sub.current_period_end && sub.current_period_start && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="relative rounded-xl border border-slate-600/60 bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-800/60 p-6 backdrop-blur-sm overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-sky-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <SubscriptionTimer
                        periodStart={sub.current_period_start}
                        periodEnd={sub.current_period_end}
                      />
                    </motion.div>
                  )}
                  {sub.current_period_end && !sub.current_period_start && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="relative rounded-xl border border-slate-600/60 bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-800/60 p-6 backdrop-blur-sm overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-sky-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <SubscriptionTimer
                        periodStart={
                          sub.plan.interval === 'year'
                            ? format(new Date(new Date(sub.current_period_end).getTime() - 365 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss'Z'")
                            : format(new Date(new Date(sub.current_period_end).getTime() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss'Z'")
                        }
                        periodEnd={sub.current_period_end}
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/60 p-8 text-center backdrop-blur-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-sky-500/5 to-emerald-500/5" />
                <motion.div
                  animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
                  transition={{ rotate: { duration: 20, repeat: Infinity, ease: 'linear' }, scale: { duration: 3, repeat: Infinity } }}
                  className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 backdrop-blur-sm border border-emerald-500/30"
                >
                  <Sparkles className="h-8 w-8 text-emerald-400" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-4 text-lg font-semibold bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent"
                >
                  No active subscription
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-2 text-sm text-slate-400 flex items-center justify-center gap-2"
                >
                  {autoSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                      Checking for recent payments…
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4 text-emerald-400" />
                      Choose a plan below to unlock all features.
                    </>
                  )}
                </motion.p>
                {!autoSyncing && (
                  <>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="mt-4 text-xs text-slate-500"
                    >
                      Already paid? We can sync your subscription from Stripe.
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 border-slate-600 bg-slate-800/50 hover:bg-gradient-to-r hover:from-emerald-600/20 hover:to-sky-600/20 hover:border-emerald-500/50 transition-all"
                        onClick={handleSyncFromStripe}
                        disabled={syncingFromStripe}
                      >
                        {syncingFromStripe ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          >
                            <Sparkle className="mr-2 h-4 w-4" />
                          </motion.div>
                        )}
                        {syncingFromStripe ? 'Syncing…' : 'I already paid – sync my subscription'}
                      </Button>
                    </motion.div>
                    {syncError && (
                      <motion.p
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-3 text-sm text-amber-400 flex items-center justify-center gap-2"
                      >
                        <AlertCircle className="h-4 w-4" />
                        {syncError}
                      </motion.p>
                    )}
                  </>
                )}
                {autoSyncing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-400" />
                  </motion.div>
                )}
              </motion.div>
            )}
          </motion.section>
        )}

        {/* Beautiful invoice card - subscribed only */}
        {isAuthenticated && hasActive && sub?.plan && subscriptionData?.invoiceUrl && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-12"
          >
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80 shadow-2xl backdrop-blur-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-sky-500/5 to-emerald-500/5" />
              <div className="relative border-b border-slate-700/60 bg-gradient-to-r from-slate-800/80 to-slate-800/40 px-6 py-5">
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-500/30"
                  >
                    <FileText className="h-6 w-6 text-emerald-400" />
                  </motion.div>
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      Latest invoice
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </motion.div>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">View or download your receipt</p>
                  </div>
                </div>
              </div>
              <div className="relative p-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl border border-slate-600/60 bg-gradient-to-br from-slate-950/80 to-slate-900/60 p-6 font-sans backdrop-blur-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-2">
                        <Zap className="h-3 w-3 text-emerald-400" />
                        Plan
                      </p>
                      <p className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">{sub.plan.name}</p>
                      <p className="mt-1 text-sm text-slate-300 flex items-center gap-2">
                        <span className="font-semibold text-white">${(sub.plan.amount_cents / 100).toFixed(2)}</span>
                        <span className="text-slate-400">USD / {sub.plan.interval === 'year' ? 'year' : 'month'}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Status</p>
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </motion.div>
                        Paid
                      </motion.span>
                    </div>
                  </div>
                  {sub.current_period_end && (
                    <div className="mt-5 pt-5 border-t border-slate-700/60 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-sky-400" />
                      <p className="text-xs text-slate-400">
                        Current period ends <span className="text-sky-400 font-medium">{format(new Date(sub.current_period_end), 'PPP')}</span>
                      </p>
                    </div>
                  )}
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-5"
                >
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 bg-slate-800/50 hover:bg-gradient-to-r hover:from-emerald-600/20 hover:to-sky-600/20 hover:border-emerald-500/50 transition-all sm:w-auto"
                    onClick={() => window.open(subscriptionData.invoiceUrl!, '_blank', 'noopener')}
                  >
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                    </motion.div>
                    View full invoice
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.section>
        )}

        {/* Plans — only show when not subscribed so subscribed users see management only */}
        {!hasActive && (
          <section>
            <h2 className="mb-6 text-lg font-semibold text-white">Choose a plan</h2>
            <PricingSection
              plans={plans}
              loading={loadingPlans}
              submittingId={submittingId}
              onSubscribe={handleSubscribe}
              showBillingToggle
            />
          </section>
        )}

        {/* Trust */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 border-t border-slate-700/60 pt-8 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <Shield className="h-4 w-4 text-emerald-400" />
              </motion.div>
              <span>Cancel anytime</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <CheckCircle2 className="h-4 w-4 text-sky-400" />
              </motion.div>
              <span>Secure payment via Stripe</span>
            </div>
            <span className="text-slate-600">•</span>
            <motion.a
              href="/contact"
              className="font-medium text-sky-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
              whileHover={{ scale: 1.05 }}
            >
              Contact us
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.a>
          </div>
        </motion.section>
      </div>
    </MainLayout>
  );
}

export default function SubscriptionPageContent() {
  return (
    <Suspense
      fallback={
        <MainLayout>
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
          </div>
        </MainLayout>
      }
    >
      <SubscriptionPageContentInner />
    </Suspense>
  );
}
