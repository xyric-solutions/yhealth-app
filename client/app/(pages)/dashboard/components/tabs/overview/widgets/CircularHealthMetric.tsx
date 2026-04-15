'use client';

import { motion } from 'framer-motion';
import { useId, useMemo } from 'react';

export type HealthMetricType =
  | 'age'
  | 'steps'
  | 'water'
  | 'calories'
  | 'nutrition'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'heartRate'
  | 'insights'
  | 'overall';

export interface HealthMetric {
  type: HealthMetricType;
  value: number;
  max?: number;
  unit?: string;
  label: string;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    label: string;
  };
  isLoading?: boolean;
}

interface CircularHealthMetricProps {
  metric: HealthMetric;
  size?: 'sm' | 'md' | 'lg';
  showTrend?: boolean;
  className?: string;
}

// Color configurations for each metric type
export const metricColors: Record<HealthMetricType, {
  primary: string;
  secondary: string;
  gradient: string;
  glow: string;
  particle: string;
}> = {
  age: {
    primary: '#10b981',
    secondary: '#14b8a6',
    gradient: 'from-emerald-400 via-green-400 to-teal-400',
    glow: 'emerald',
    particle: '#10b981',
  },
  steps: {
    primary: '#22c55e',
    secondary: '#16a34a',
    gradient: 'from-green-400 via-emerald-400 to-teal-400',
    glow: 'emerald',
    particle: '#22c55e',
  },
  water: {
    primary: '#06b6d4',
    secondary: '#0891b2',
    gradient: 'from-cyan-400 via-blue-400 to-sky-400',
    glow: 'cyan',
    particle: '#06b6d4',
  },
  calories: {
    primary: '#f97316',
    secondary: '#ea580c',
    gradient: 'from-orange-400 via-amber-400 to-red-400',
    glow: 'orange',
    particle: '#f97316',
  },
  nutrition: {
    primary: '#a855f7',
    secondary: '#9333ea',
    gradient: 'from-purple-400 via-pink-400 to-fuchsia-400',
    glow: 'purple',
    particle: '#a855f7',
  },
  protein: {
    primary: '#ec4899',
    secondary: '#ef4444',
    gradient: 'from-pink-400 via-rose-400 to-red-400',
    glow: 'pink',
    particle: '#ec4899',
  },
  carbs: {
    primary: '#f59e0b',
    secondary: '#eab308',
    gradient: 'from-amber-400 via-yellow-400 to-orange-400',
    glow: 'amber',
    particle: '#f59e0b',
  },
  fat: {
    primary: '#a855f7',
    secondary: '#8b5cf6',
    gradient: 'from-purple-400 via-violet-400 to-fuchsia-400',
    glow: 'purple',
    particle: '#a855f7',
  },
  heartRate: {
    primary: '#ef4444',
    secondary: '#dc2626',
    gradient: 'from-red-400 via-rose-400 to-pink-400',
    glow: 'red',
    particle: '#ef4444',
  },
  insights: {
    primary: '#6366f1',
    secondary: '#4f46e5',
    gradient: 'from-indigo-400 via-violet-400 to-purple-400',
    glow: 'indigo',
    particle: '#6366f1',
  },
  overall: {
    primary: '#8b5cf6',
    secondary: '#7c3aed',
    gradient: 'from-violet-400 via-purple-400 to-fuchsia-400',
    glow: 'purple',
    particle: '#8b5cf6',
  },
};

// Size configurations - responsive (mobile-first)
const sizeConfig = {
  sm: { circle: 72, stroke: 5, fontSize: 'text-[14px]', labelSize: 'text-[11px]' },
  md: { circle: 144, stroke: 8, fontSize: 'text-xl', labelSize: 'text-xs' },
  lg: { circle: 160, stroke: 10, fontSize: 'text-lg', labelSize: 'text-sm' },
};

export function CircularHealthMetric({
  metric,
  size = 'md',
  showTrend = true,
  className = '',
}: CircularHealthMetricProps) {
  const instanceId = useId();
  const colors = metricColors[metric.type];
  const config = sizeConfig[size];
  const radius = (config.circle - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate progress (0-100)
  const progress = useMemo(() => {
    if (metric.isLoading) return 0;
    if (metric.max && metric.max > 0 && metric.value > 0) {
      return Math.min((metric.value / metric.max) * 100, 100);
    }
    // For metrics without max (like age), show full circle
    if (metric.value > 0) return 100;
    return 0;
  }, [metric.value, metric.max, metric.isLoading]);

  const dashOffset = circumference * (1 - progress / 100);

  // Format value display
  const displayValue = useMemo(() => {
    if (metric.isLoading) return '—';
    if (metric.type === 'age') return metric.value.toFixed(1);
    if (metric.type === 'steps' || metric.type === 'calories') {
      return metric.value.toLocaleString();
    }
    // For nutrition metrics (protein, carbs, fat), format to 2 decimal places
    if (metric.type === 'protein' || metric.type === 'carbs' || metric.type === 'fat' || metric.type === 'nutrition') {
      return parseFloat(metric.value.toFixed(2)).toString();
    }
    return metric.value.toString();
  }, [metric.value, metric.type, metric.isLoading]);


  return (
    <div className={`relative ${className}`}>
      {/* Circular SVG */}
      <div 
        className="relative" 
        style={{ width: config.circle, height: config.circle }}
        role="img"
        aria-label={`${metric.label}: ${displayValue}${metric.unit ? ` ${metric.unit}` : ''}`}
      >
        <svg
          className="transform -rotate-90"
          width={config.circle}
          height={config.circle}
          viewBox={`0 0 ${config.circle} ${config.circle}`}
          aria-hidden="true"
        >
          {/* Gradient definitions - must come before usage */}
          <defs>
            <linearGradient id={`gradient-${instanceId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="1" />
              <stop offset="100%" stopColor={colors.secondary} stopOpacity="1" />
            </linearGradient>
            <radialGradient id={`bg-gradient-${instanceId}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.15" />
              <stop offset="100%" stopColor={colors.secondary} stopOpacity="0.05" />
            </radialGradient>
          </defs>

          {/* Background circle with fill */}
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            fill={`url(#bg-gradient-${metric.type})`}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={config.stroke}
          />

          {/* Progress circle */}
          {progress > 0 && (
            <motion.circle
              cx={config.circle / 2}
              cy={config.circle / 2}
              r={radius}
              fill="none"
              stroke={`url(#gradient-${metric.type})`}
              strokeWidth={config.stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              style={{
                filter: `drop-shadow(0 0 8px ${colors.primary}40)`,
              }}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="text-center"
          >
            <p
              className={`${config.fontSize} font-bold text-white mb-1 drop-shadow-2xl`}
              style={{ 
                textShadow: `0 0 30px ${colors.primary}80, 0 2px 4px rgba(0, 0, 0, 0.5)`,
                letterSpacing: '-0.02em',
              }}
              aria-hidden="true"
            >
              {displayValue}
            </p>
            {metric.unit && (
              <p className={`${config.labelSize} font-medium text-slate-300/80 mb-1`} aria-hidden="true">
                {metric.unit}
              </p>
            )}
            <p 
              className={`${config.labelSize} font-semibold tracking-wider`} 
              style={{ color: colors.primary }}
              aria-hidden="true"
            >
              {metric.label}
            </p>
            {metric.subtitle && (
              <p className="text-xs text-slate-400 mt-1" aria-hidden="true">{metric.subtitle}</p>
            )}
            {/* Trend text inside circle - only for age metric */}
            {showTrend && metric.trend && metric.type === 'age' && (
              <p 
                className="text-[11px] font-medium mt-2" 
                style={{ color: colors.primary }}
                aria-hidden="true"
              >
                {metric.trend.label}
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

