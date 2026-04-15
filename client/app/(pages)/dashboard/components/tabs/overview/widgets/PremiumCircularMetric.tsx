'use client';

import { motion } from 'framer-motion';
import { ThickGradientArc } from './circular-variants/ThickGradientArc';
import { GlowEndpointArc } from './circular-variants/GlowEndpointArc';
import { DoubleRingArc } from './circular-variants/DoubleRingArc';
import { SegmentedArc } from './circular-variants/SegmentedArc';
import { TickMarkedArc } from './circular-variants/TickMarkedArc';
import { WaveArc } from './circular-variants/WaveArc';
import { MultiRingArc } from './circular-variants/MultiRingArc';

interface PremiumCircularMetricProps {
  type: string;
  value: number | null;
  max: number;
  label: string;
  unit?: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  delay?: number;
  onClick?: () => void;
  isLoading?: boolean;
  subtitle?: string;
  extraData?: Record<string, unknown>;
}

const COLOR_MAP: Record<string, { primary: string; secondary: string; glow: string; tertiary: string }> = {
  emerald: { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16, 185, 129, 0.4)', tertiary: '#6ee7b7' },
  cyan:    { primary: '#06b6d4', secondary: '#22d3ee', glow: 'rgba(6, 182, 212, 0.4)',   tertiary: '#67e8f9' },
  orange:  { primary: '#f97316', secondary: '#fb923c', glow: 'rgba(249, 115, 22, 0.4)',  tertiary: '#fdba74' },
  purple:  { primary: '#a855f7', secondary: '#c084fc', glow: 'rgba(168, 85, 247, 0.4)',  tertiary: '#d8b4fe' },
  red:     { primary: '#ef4444', secondary: '#f87171', glow: 'rgba(239, 68, 68, 0.4)',   tertiary: '#fca5a5' },
  indigo:  { primary: '#6366f1', secondary: '#818cf8', glow: 'rgba(99, 102, 241, 0.4)',  tertiary: '#a5b4fc' },
};

/** Maps metric type → visual variant */
const VARIANT_MAP: Record<string, string> = {
  sleep: 'doubleRing',
  overall: 'tickMarked',
  insights: 'segmented',
  age: 'thickGradient',
  water: 'wave',
  calories: 'glowEndpoint',
  nutrition: 'multiRing',
};

export function PremiumCircularMetric({
  type,
  value,
  max,
  label,
  unit,
  color,
  icon: Icon,
  delay = 0,
  onClick,
  isLoading = false,
  subtitle,
  extraData,
}: PremiumCircularMetricProps) {
  const progress = value !== null ? Math.min(100, (value / max) * 100) : 0;
  const colors = COLOR_MAP[color] || COLOR_MAP.emerald;
  const displayValue = value !== null ? (type === 'age' ? value.toFixed(1) : Math.round(value)) : '--';
  const variant = VARIANT_MAP[type] || 'thickGradient';

  const variantProps = { progress, colors, type, delay, isLoading, extraData };

  const renderVariant = () => {
    switch (variant) {
      case 'doubleRing':
        return <DoubleRingArc {...variantProps} />;
      case 'tickMarked':
        return <TickMarkedArc {...variantProps} />;
      case 'segmented':
        return <SegmentedArc {...variantProps} />;
      case 'wave':
        return <WaveArc {...variantProps} />;
      case 'glowEndpoint':
        return <GlowEndpointArc {...variantProps} />;
      case 'multiRing':
        return <MultiRingArc {...variantProps} />;
      case 'thickGradient':
      default:
        return <ThickGradientArc {...variantProps} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay, type: 'spring', stiffness: 200 }}
      whileHover={{ scale: 1.03 }}
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-1 sm:p-2 md:p-4 ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Icon */}
      <motion.div
        className="mb-1 sm:mb-2"
        whileHover={{ scale: 1.2, rotate: 5 }}
        transition={{ type: 'spring', stiffness: 400 }}
      >
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.primary }} />
      </motion.div>

      {/* Circular progress */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-44 lg:h-44">
        {renderVariant()}

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
          <motion.span
            className="text-[16px] sm:text-[18px] md:text-xl lg:text-2xl font-bold text-white leading-tight"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.3, type: 'spring' }}
          >
            {displayValue}
          </motion.span>
          {unit && (
            <span className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-300/80">{unit}</span>
          )}
          <span className="text-[10px] sm:text-xs md:text-sm font-semibold tracking-wider uppercase mt-0.5" style={{ color: colors.primary }}>
            {label}
          </span>
          {subtitle && (
            <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate max-w-full text-center">{subtitle}</span>
          )}
        </div>
      </div>

{/* Water ripple removed */}
    </motion.div>
  );
}
