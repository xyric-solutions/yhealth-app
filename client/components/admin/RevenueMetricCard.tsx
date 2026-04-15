'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { useCountUp } from '@/hooks/use-count-up';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface RevenueMetricCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  period: string;
  isLoading?: boolean;
  delay?: number;
  prefix?: string;
  suffix?: string;
}

export function RevenueMetricCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  period,
  isLoading = false,
  delay = 0,
  prefix = '$',
  suffix = '',
}: RevenueMetricCardProps) {
  const countValue = useCountUp(value, !isLoading);
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseYSpring = useSpring(y, { stiffness: 500, damping: 100 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['17.5deg', '-17.5deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-17.5deg', '17.5deg']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = (mouseX / rect.width - 0.5) * 2;
    const yPct = (mouseY / rect.height - 0.5) * 2;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.17, 0.67, 0.83, 0.91] }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col gap-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10"
    >
      {/* Animated Gradient Border */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${color.replace('text-', '#').replace('-400', '400')}20, transparent)`,
        }}
      />

      {/* Inner Glow */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 blur-xl',
          bgColor
        )}
        style={{ transform: 'translateZ(-1px)' }}
      />

      {/* Icon */}
      <motion.div
        className={cn(
          `relative flex h-14 w-14 items-center justify-center rounded-xl ${bgColor} transition-transform duration-300 group-hover:scale-110`,
          'shadow-lg'
        )}
        style={{ transform: 'translateZ(20px)' }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: delay + 0.2, duration: 0.5 }}
        whileHover={{ rotate: 15, scale: 1.2 }}
      >
        <Icon className={cn('h-7 w-7', color)} />
        <motion.span
          className={cn('absolute -top-1 -right-1 h-3 w-3 rounded-full', color.replace('text-', 'bg-'))}
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: delay + 0.5 }}
        />
      </motion.div>

      {/* Content */}
      <div className="relative flex-1 min-w-0" style={{ transform: 'translateZ(10px)' }}>
        <motion.p
          className="text-3xl font-bold text-white mb-1"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.3, duration: 0.5 }}
        >
          {prefix}
          <motion.span
            key={countValue}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {countValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.span>
          {suffix}
        </motion.p>
        <motion.p
          className="text-sm text-slate-400 mb-1"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.4, duration: 0.5 }}
        >
          {title}
        </motion.p>
        <motion.p
          className="text-xs text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.5, duration: 0.5 }}
        >
          {period}
        </motion.p>
      </div>

      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: 'linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
}

