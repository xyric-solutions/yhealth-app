"use client";

import { motion } from "framer-motion";
import { useId, useMemo } from "react";

interface MacroCircularChartProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  primaryColor: string;
  secondaryColor: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: {
    circle: 100,
    stroke: 10,
    trackStroke: 10,
    valueFontSize: 'text-[17px]',
    unitFontSize: 'text-[10px]',
    labelFontSize: 'text-[11px]',
    targetFontSize: 'text-[11px]',
  },
  md: {
    circle: 120,
    stroke: 12,
    trackStroke: 12,
    valueFontSize: 'text-[20px]',
    unitFontSize: 'text-[11px]',
    labelFontSize: 'text-xs',
    targetFontSize: 'text-xs',
  },
  lg: {
    circle: 150,
    stroke: 14,
    trackStroke: 14,
    valueFontSize: 'text-[24px]',
    unitFontSize: 'text-[12px]',
    labelFontSize: 'text-[13px]',
    targetFontSize: 'text-[13px]',
  },
};

export function MacroCircularChart({
  value,
  max,
  label,
  unit,
  primaryColor,
  secondaryColor,
  size = 'md',
  className = '',
}: MacroCircularChartProps) {
  const instanceId = useId();
  const config = sizeConfig[size];
  const radius = (config.circle - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useMemo(() => {
    if (max > 0 && value > 0) {
      return Math.min(value / max, 1);
    }
    return 0;
  }, [value, max]);

  const percentage = Math.round(progress * 100);
  const displayValue = useMemo(() => Math.round(value).toLocaleString(), [value]);

  // Arc length for filled portion
  const dashOffset = circumference * (1 - progress);

  // Generate a lighter tint of the primary color for the track
  const trackColor = `${primaryColor}18`;

  return (
    <div className={`relative flex flex-col items-center gap-2.5 ${className}`}>
      {/* Circular ring container */}
      <div
        className="relative group"
        style={{ width: config.circle, height: config.circle }}
        role="img"
        aria-label={`${label}: ${displayValue} ${unit} of ${max} ${unit} (${percentage}%)`}
      >
        {/* Outer glow on hover */}
        <div
          className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, ${primaryColor}15 0%, transparent 70%)`,
          }}
        />

        <svg
          className="transform -rotate-90"
          width={config.circle}
          height={config.circle}
          viewBox={`0 0 ${config.circle} ${config.circle}`}
          aria-hidden="true"
        >
          <defs>
            {/* Gradient for the progress arc */}
            <linearGradient id={`macro-grad-${instanceId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={primaryColor} />
              <stop offset="50%" stopColor={secondaryColor} />
              <stop offset="100%" stopColor={primaryColor} />
            </linearGradient>

            {/* Glow filter */}
            <filter id={`glow-${instanceId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track — subtle ring */}
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={config.trackStroke}
            strokeLinecap="round"
          />

          {/* Filled progress arc */}
          {progress > 0 && (
            <motion.circle
              cx={config.circle / 2}
              cy={config.circle / 2}
              r={radius}
              fill="none"
              stroke={`url(#macro-grad-${instanceId})`}
              strokeWidth={config.stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
              filter={`url(#glow-${instanceId})`}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 20 }}
            className="text-center"
          >
            <p
              className={`${config.valueFontSize} font-extrabold text-white leading-none tracking-tight`}
              style={{
                textShadow: `0 0 20px ${primaryColor}50`,
              }}
            >
              {displayValue}
            </p>
            <p className={`${config.unitFontSize} font-medium text-slate-400 mt-0.5`}>
              {unit}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Label & target below */}
      <div className="text-center space-y-0.5">
        <p
          className={`${config.labelFontSize} font-bold tracking-wide`}
          style={{ color: primaryColor }}
        >
          {label}
        </p>
        <p className={`${config.targetFontSize} text-slate-500 tabular-nums`}>
          {Math.round(value)} / {max} {unit}
        </p>
      </div>
    </div>
  );
}
