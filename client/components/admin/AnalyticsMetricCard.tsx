'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { useCountUp } from '@/hooks/use-count-up';
import { useRef } from 'react';

interface AnalyticsMetricCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  suffix?: string;
  prefix?: string;
  isLoading?: boolean;
  delay?: number;
}

export function AnalyticsMetricCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  trend,
  suffix = '',
  prefix = '',
  isLoading = false,
  delay = 0,
}: AnalyticsMetricCardProps) {
  const countValue = useCountUp(value, !isLoading);
  const ref = useRef<HTMLDivElement>(null);

  // 3D tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseYSpring = useSpring(y, { stiffness: 500, damping: 100 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['7.5deg', '-7.5deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-7.5deg', '7.5deg']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
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
      transition={{ 
        delay, 
        duration: 0.5,
        type: 'spring',
        stiffness: 200,
        damping: 20
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      className="group relative flex items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/80 border border-slate-700/50 backdrop-blur-xl px-5 py-4 overflow-hidden cursor-pointer"
    >
      {/* 3D Depth Shadow */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
          transform: 'translateZ(-20px)',
        }}
      />

      {/* Animated Gradient Overlay */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        animate={{
          background: [
            'radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)',
            'radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
            'radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)',
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Top Glow Line */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ opacity: 0, scaleX: 0 }}
        whileHover={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Bottom Glow Line */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-white/5 to-transparent rounded-br-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-white/5 to-transparent rounded-tl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Icon Container with 3D Effect */}
      <motion.div
        className={`relative flex h-12 w-12 items-center justify-center rounded-xl ${bgColor} shadow-lg`}
        style={{ transform: 'translateZ(20px)' }}
        whileHover={{ 
          scale: 1.15,
          rotate: [0, -5, 5, -5, 0],
        }}
        transition={{
          scale: { type: 'spring', stiffness: 400, damping: 10 },
          rotate: { duration: 0.5 },
        }}
      >
        {/* Icon Glow */}
        <motion.div
          className={`absolute inset-0 rounded-xl ${bgColor} blur-xl opacity-0 group-hover:opacity-50`}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <Icon className={`relative h-6 w-6 ${color} drop-shadow-lg`} />
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-w-0 relative" style={{ transform: 'translateZ(10px)' }}>
        <motion.p
          className="text-3xl font-bold text-white mb-0.5 tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.1 }}
        >
          {prefix}
          <motion.span
            key={countValue}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {countValue}
          </motion.span>
          {suffix}
        </motion.p>
        <p className="text-xs font-medium text-slate-400 truncate mb-1">{title}</p>
        {trend && (
          <motion.div
            className={`flex items-center gap-1.5 text-xs font-semibold ${trend.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.2 }}
          >
            <motion.div
              animate={{
                y: trend.isPositive ? [0, -2, 0] : [0, 2, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
            </motion.div>
            <span>{Math.abs(trend.value)}%</span>
            <span className="text-slate-500 text-[10px]">
              {trend.isPositive ? 'increase' : 'decrease'}
            </span>
          </motion.div>
        )}
      </div>

      {/* Hover Glow Effect */}
      <motion.div
        className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"
        style={{
          background: color.includes('emerald')
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), transparent)'
            : color.includes('amber')
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), transparent)'
            : color.includes('purple')
            ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), transparent)'
            : color.includes('rose')
            ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), transparent)'
            : color.includes('sky')
            ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), transparent)'
            : color.includes('indigo')
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), transparent)'
            : color.includes('cyan')
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), transparent)'
            : 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), transparent)',
        }}
      />

      {/* Shine Effect on Hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100"
        style={{
          background: 'linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
          transform: 'translateX(-100%)',
        }}
        animate={{
          transform: ['translateX(-100%)', 'translateX(100%)'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatDelay: 2,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}

