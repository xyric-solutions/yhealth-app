'use client';

import { motion } from 'framer-motion';
import { CircularHealthMetric, HealthMetric, HealthMetricType } from './CircularHealthMetric';

interface CircularMetricCardProps {
  metric: HealthMetric;
  icon?: React.ReactNode;
  additionalInfo?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const _metricGlowMap: Record<HealthMetricType, string> = {
  age: 'emerald',
  steps: 'emerald',
  water: 'cyan',
  calories: 'orange',
  nutrition: 'purple',
  protein: 'pink',
  carbs: 'amber',
  fat: 'purple',
  heartRate: 'red',
  insights: 'indigo',
  overall: 'purple',
};

export function CircularMetricCard({
  metric,
  icon,
  additionalInfo: _additionalInfo,
  size = 'md',
  className = '',
}: CircularMetricCardProps) {

  const _glowShadowMap: Record<string, string> = {
    emerald: '0 0 20px rgba(16, 185, 129, 0.2)',
    cyan: '0 0 20px rgba(6, 182, 212, 0.2)',
    orange: '0 0 20px rgba(249, 115, 22, 0.2)',
    purple: '0 0 20px rgba(168, 85, 247, 0.2)',
    red: '0 0 20px rgba(239, 68, 68, 0.2)',
    indigo: '0 0 20px rgba(99, 102, 241, 0.2)',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-visible flex flex-col items-center justify-center ${className}`}
      style={{
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      }}
    >
      {/* Subtle particle effect - very subtle */}
      {/* <ParticleBackground color={glowColor} particleCount={40} className="absolute inset-0 rounded-full" opacity={0.2} /> */}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Icon (if provided) */}
        {icon && (
          <motion.div 
            className="mb-4 opacity-90"
            whileHover={{ opacity: 1, scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            {icon}
          </motion.div>
        )}

        {/* Circular metric - larger size */}
        <CircularHealthMetric metric={metric} size={size} showTrend={!!metric.trend} />

        {/* Additional info */}
        {/* {additionalInfo && (
          <div className="mt-6 w-full">
            {additionalInfo}
          </div>
        )} */}
      </div>
    </motion.div>
  );
}

