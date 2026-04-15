'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Thermometer, Bone, BedDouble, Palmtree, Plane, Brain,
  Sparkles, SmilePlus, Meh, Frown, ChevronDown, Check, Shield,
} from 'lucide-react';
import { api } from '@/lib/api-client';

// ── Injected CSS (animations + effects) ─────────────────────────
const STATUS_CSS = `
  @keyframes sw-pulse {
    0%,100% { opacity: .15; transform: scale(1); }
    50%     { opacity: .4;  transform: scale(1.15); }
  }
  @keyframes sw-orbit {
    0%   { transform: rotate(0deg) translateX(22px) rotate(0deg); }
    100% { transform: rotate(360deg) translateX(22px) rotate(-360deg); }
  }
  @keyframes sw-ring-spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes sw-shimmer {
    0%   { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(200%) skewX(-12deg); }
  }
  @keyframes sw-glow {
    0%,100% { box-shadow: 0 0 0 1px var(--sw-color-20), 0 0 20px var(--sw-color-06); }
    50%     { box-shadow: 0 0 0 1px var(--sw-color-35), 0 0 40px var(--sw-color-15), 0 0 80px var(--sw-color-06); }
  }
  @keyframes sw-dot-pop {
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.3); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes sw-float {
    0%,100% { transform: translateY(0px); }
    50%     { transform: translateY(-3px); }
  }
  .sw-timeline-dot {
    animation: sw-dot-pop .4s cubic-bezier(.34,1.56,.64,1) both;
  }
`;

// ── Status Config ──────────────────────────────────────────────
type ActivityStatus = 'working' | 'sick' | 'injury' | 'rest' | 'vacation' | 'travel' | 'stress' | 'excellent' | 'good' | 'fair' | 'poor';

interface StatusCfg {
  icon: React.ElementType;
  color: string;
  rgb: string;
  gradient: string;
  label: string;
  emoji: string;
  desc: string;
}

const STATUS_CONFIG: Record<ActivityStatus, StatusCfg> = {
  working:   { icon: Briefcase,    color: '#22C55E', rgb: '34,197,94',   gradient: 'linear-gradient(135deg,#22c55e,#16a34a)', label: 'Working',   emoji: '💼', desc: 'On track & active' },
  sick:      { icon: Thermometer,  color: '#EF4444', rgb: '239,68,68',   gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', label: 'Sick',      emoji: '🤒', desc: 'Rest & recover' },
  injury:    { icon: Bone,         color: '#F97316', rgb: '249,115,22',  gradient: 'linear-gradient(135deg,#f97316,#ea580c)', label: 'Injured',   emoji: '🩹', desc: 'Take it easy' },
  rest:      { icon: BedDouble,    color: '#8B5CF6', rgb: '139,92,246',  gradient: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', label: 'Resting',   emoji: '😴', desc: 'Recovery mode' },
  vacation:  { icon: Palmtree,     color: '#06B6D4', rgb: '6,182,212',   gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)', label: 'Vacation',  emoji: '🏖️', desc: 'Enjoy & recharge' },
  travel:    { icon: Plane,        color: '#3B82F6', rgb: '59,130,246',  gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)', label: 'Traveling', emoji: '✈️', desc: 'On the move' },
  stress:    { icon: Brain,        color: '#EC4899', rgb: '236,72,153',  gradient: 'linear-gradient(135deg,#ec4899,#db2777)', label: 'Stressed',  emoji: '😓', desc: 'Be gentle today' },
  excellent: { icon: Sparkles,     color: '#10B981', rgb: '16,185,129',  gradient: 'linear-gradient(135deg,#10b981,#059669)', label: 'Excellent', emoji: '✨', desc: 'Peak performance' },
  good:      { icon: SmilePlus,    color: '#22C55E', rgb: '34,197,94',   gradient: 'linear-gradient(135deg,#22c55e,#16a34a)', label: 'Good',      emoji: '😊', desc: 'Feeling great' },
  fair:      { icon: Meh,          color: '#F59E0B', rgb: '245,158,11',  gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', label: 'Fair',      emoji: '😐', desc: 'Hanging in there' },
  poor:      { icon: Frown,        color: '#EF4444', rgb: '239,68,68',   gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', label: 'Poor',      emoji: '😟', desc: 'Take care of yourself' },
};

const QUICK_STATUSES: ActivityStatus[] = ['working', 'sick', 'rest', 'travel', 'stress', 'vacation'];

interface EnhancedStatusData {
  status: ActivityStatus;
  since: string | null;
  expectedEndDate: string | null;
  daysInStatus: number;
  activeOverrides: Record<string, unknown> | null;
  last7Days: Array<{ date: string; status: string }>;
}

// ── Animated Icon Orb ─────────────────────────────────────────
function StatusOrb({ cfg, isNonWorking }: { cfg: StatusCfg; isNonWorking: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = cfg.icon as any;
  return (
    <div className="relative w-14 h-14 shrink-0">
      {/* Outer glow pulse */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: `radial-gradient(circle, rgba(${cfg.rgb},0.25) 0%, transparent 70%)`,
          animation: isNonWorking ? 'sw-pulse 3s ease-in-out infinite' : 'none',
        }}
      />

      {/* Spinning accent ring */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56" style={{ animation: 'sw-ring-spin 12s linear infinite' }}>
        <circle
          cx="28" cy="28" r="26"
          fill="none"
          stroke={`rgba(${cfg.rgb},0.15)`}
          strokeWidth="1"
          strokeDasharray="8 12"
        />
      </svg>

      {/* Icon container */}
      <motion.div
        className="absolute inset-1 rounded-[14px] flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, rgba(${cfg.rgb},0.15), rgba(${cfg.rgb},0.06))`,
          border: `1px solid rgba(${cfg.rgb},0.2)`,
          boxShadow: `0 4px 12px rgba(${cfg.rgb},0.15), inset 0 1px 0 rgba(255,255,255,0.06)`,
          animation: isNonWorking ? 'sw-float 3s ease-in-out infinite' : 'none',
        }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 400 }}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 w-[200%]"
            style={{
              background: `linear-gradient(90deg, transparent 30%, rgba(${cfg.rgb},0.12) 50%, transparent 70%)`,
              animation: 'sw-shimmer 4s ease-in-out infinite',
            }}
          />
        </div>
        <Icon className="w-6 h-6 relative z-10" style={{ color: cfg.color }} />
      </motion.div>

      {/* Orbiting particle (only for non-working) */}
      {isNonWorking && (
        <div
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full -mt-[3px] -ml-[3px]"
          style={{
            background: cfg.color,
            boxShadow: `0 0 6px ${cfg.color}`,
            animation: 'sw-orbit 4s linear infinite',
          }}
        />
      )}
    </div>
  );
}

// ── Timeline Dot ──────────────────────────────────────────────
function TimelineDot({ day, index, total, isToday }: {
  day: { date: string; status: string };
  index: number;
  total: number;
  isToday: boolean;
}) {
  const dayCfg = STATUS_CONFIG[day.status as ActivityStatus] ?? STATUS_CONFIG.working;
  const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5 flex-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
    >
      {/* Dot */}
      <div className="relative">
        <div
          className="sw-timeline-dot rounded-full transition-all duration-300"
          style={{
            width: isToday ? 14 : 10,
            height: isToday ? 14 : 10,
            background: isToday ? dayCfg.gradient : `rgba(${dayCfg.rgb},${isToday ? 1 : 0.4})`,
            boxShadow: isToday ? `0 0 12px rgba(${dayCfg.rgb},0.5), 0 0 24px rgba(${dayCfg.rgb},0.2)` : 'none',
            animationDelay: `${0.3 + index * 0.06}s`,
          }}
        />
        {/* Today indicator ring */}
        {isToday && (
          <div
            className="absolute -inset-1 rounded-full"
            style={{
              border: `1.5px solid rgba(${dayCfg.rgb},0.3)`,
              animation: 'sw-pulse 2.5s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Day label */}
      <span
        className="text-[9px] leading-none font-medium"
        style={{ color: isToday ? dayCfg.color : 'rgba(148,163,184,0.5)' }}
      >
        {dayLabel}
      </span>

      {/* Connector line (not on last) */}
      {index < total - 1 && (
        <div
          className="absolute top-[7px] left-[55%] h-[1px]"
          style={{
            width: 'calc(100% - 10px)',
            background: `linear-gradient(90deg, rgba(${dayCfg.rgb},0.15), rgba(255,255,255,0.03))`,
          }}
        />
      )}
    </motion.div>
  );
}

// ── Main Widget ──────────────────────────────────────────────
export function StatusWidget() {
  const [data, setData] = useState<EnhancedStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: EnhancedStatusData }>('/activity-status/enhanced-current');
      const body = res.data as unknown as { data?: EnhancedStatusData } | EnhancedStatusData;
      setData('data' in body && body.data ? body.data : body as EnhancedStatusData);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const updateStatus = async (newStatus: ActivityStatus) => {
    setUpdating(true);
    try {
      await api.put('/activity-status/current', { status: newStatus });
      await fetchStatus();
      setShowPicker(false);
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  const cfg = useMemo(() => {
    if (!data) return STATUS_CONFIG.working;
    return STATUS_CONFIG[data.status] ?? STATUS_CONFIG.working;
  }, [data]);

  // ── Loading skeleton ─────────
  if (loading || !data) {
    return (
      <div
        className="rounded-[20px] border border-white/[0.06] p-5 animate-pulse"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.1) 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04]" />
          <div className="flex-1">
            <div className="h-5 w-24 bg-white/[0.06] rounded-lg mb-2" />
            <div className="h-3 w-32 bg-white/[0.04] rounded" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-white/[0.04]" />
              <div className="w-2 h-2 bg-white/[0.03] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isNonWorking = !['working', 'excellent', 'good'].includes(data.status);

  let daysRemaining: number | null = null;
  if (data.expectedEndDate) {
    const end = new Date(data.expectedEndDate);
    daysRemaining = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  }

  return (
    <>
      <style>{STATUS_CSS}</style>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="relative rounded-[20px] overflow-hidden"
        style={{
          '--sw-color-06': `rgba(${cfg.rgb},0.06)`,
          '--sw-color-15': `rgba(${cfg.rgb},0.15)`,
          '--sw-color-20': `rgba(${cfg.rgb},0.2)`,
          '--sw-color-35': `rgba(${cfg.rgb},0.35)`,
          background: 'linear-gradient(180deg, rgba(12,14,24,0.95) 0%, rgba(6,8,16,0.98) 100%)',
          border: `1px solid rgba(${cfg.rgb},0.1)`,
          animation: isNonWorking ? 'sw-glow 4s ease-in-out infinite' : 'none',
          boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(${cfg.rgb},0.08)`,
        } as React.CSSProperties}
      >
        {/* Top gradient accent bar */}
        <div
          className="h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, transparent 5%, rgba(${cfg.rgb},0.6) 50%, transparent 95%)` }}
        />

        {/* Ambient corner glow */}
        <div
          className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{
            background: `radial-gradient(circle at top right, rgba(${cfg.rgb},0.08) 0%, transparent 60%)`,
          }}
        />

        <div className="relative p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Activity Status</span>
            </div>
            {isNonWorking && daysRemaining !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{
                  background: `linear-gradient(135deg, rgba(${cfg.rgb},0.12), rgba(${cfg.rgb},0.04))`,
                  border: `1px solid rgba(${cfg.rgb},0.15)`,
                }}
              >
                <div className="w-1 h-1 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }} />
                <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                  {daysRemaining === 0 ? 'Ending today' : `${daysRemaining}d left`}
                </span>
              </motion.div>
            )}
          </div>

          {/* Main status row */}
          <div className="flex items-center gap-3.5 mt-3 mb-5">
            <StatusOrb cfg={cfg} isNonWorking={isNonWorking} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-white tracking-tight">{cfg.label}</h4>
                <span className="text-base">{cfg.emoji}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{cfg.desc}</p>
              {data.daysInStatus > 0 && (
                <p className="text-[10px] mt-1" style={{ color: `rgba(${cfg.rgb},0.6)` }}>
                  {data.daysInStatus === 1 ? 'Since yesterday' : `Day ${data.daysInStatus}`}
                </p>
              )}
            </div>

            {/* Toggle picker */}
            <motion.button
              onClick={() => setShowPicker(!showPicker)}
              className="p-2 rounded-xl border transition-colors"
              style={{
                background: showPicker ? `rgba(${cfg.rgb},0.1)` : 'rgba(255,255,255,0.03)',
                borderColor: showPicker ? `rgba(${cfg.rgb},0.2)` : 'rgba(255,255,255,0.06)',
                color: showPicker ? cfg.color : '#64748b',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div animate={{ rotate: showPicker ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>
          </div>

          {/* Quick-change status picker */}
          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ height: 0, opacity: 0, y: -8 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden mb-5"
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {QUICK_STATUSES.map((s, i) => {
                    const sc = STATUS_CONFIG[s];
                    const isActive = data.status === s;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const SIcon = sc.icon as any;
                    return (
                      <motion.button
                        key={s}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => !isActive && !updating && updateStatus(s)}
                        disabled={updating}
                        className="relative flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-medium transition-all overflow-hidden"
                        style={{
                          background: isActive
                            ? `linear-gradient(135deg, rgba(${sc.rgb},0.15), rgba(${sc.rgb},0.05))`
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isActive ? `rgba(${sc.rgb},0.25)` : 'rgba(255,255,255,0.04)'}`,
                          color: isActive ? sc.color : '#64748b',
                          opacity: updating ? 0.4 : 1,
                        }}
                        whileHover={!isActive ? { background: 'rgba(255,255,255,0.04)', scale: 1.02 } : {}}
                        whileTap={{ scale: 0.97 }}
                      >
                        {isActive ? (
                          <Check className="w-3 h-3" style={{ color: sc.color }} />
                        ) : (
                          <SIcon className="w-3 h-3 opacity-50" />
                        )}
                        {sc.label}
                        {isActive && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `radial-gradient(circle at 20% 50%, rgba(${sc.rgb},0.08) 0%, transparent 50%)`,
                            }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 7-Day Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-slate-600 uppercase tracking-[0.12em] font-semibold">Last 7 Days</span>
              <div className="h-[1px] flex-1 mx-3" style={{ background: `linear-gradient(90deg, rgba(${cfg.rgb},0.1), transparent)` }} />
            </div>
            <div className="flex items-start gap-0.5 relative">
              {data.last7Days.map((day, i) => (
                <TimelineDot
                  key={day.date}
                  day={day}
                  index={i}
                  total={data.last7Days.length}
                  isToday={i === data.last7Days.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Active overrides banner */}
          <AnimatePresence>
            {data.activeOverrides && isNonWorking && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, rgba(${cfg.rgb},0.06), rgba(${cfg.rgb},0.02))`,
                    border: `1px solid rgba(${cfg.rgb},0.08)`,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `rgba(${cfg.rgb},0.12)` }}
                  >
                    <Shield className="w-3 h-3" style={{ color: cfg.color }} />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Plans auto-adjusted for <span style={{ color: cfg.color }} className="font-medium">{cfg.label.toLowerCase()}</span> status
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
