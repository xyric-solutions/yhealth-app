'use client';

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type AccentColor = 'emerald' | 'cyan' | 'purple' | 'amber' | 'red' | 'blue' | 'sky' | 'orange' | 'pink' | 'none';

const ACCENT_MAP: Record<AccentColor, { glow: string; border: string; shadow: string }> = {
  emerald: { glow: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)', shadow: 'rgba(16,185,129,0.06)' },
  cyan:    { glow: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.15)',   shadow: 'rgba(6,182,212,0.06)' },
  purple:  { glow: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.15)',  shadow: 'rgba(139,92,246,0.06)' },
  amber:   { glow: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.15)',  shadow: 'rgba(245,158,11,0.06)' },
  red:     { glow: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.15)',   shadow: 'rgba(239,68,68,0.06)' },
  blue:    { glow: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.15)',  shadow: 'rgba(59,130,246,0.06)' },
  sky:     { glow: 'rgba(14,165,233,0.08)',   border: 'rgba(14,165,233,0.15)',  shadow: 'rgba(14,165,233,0.06)' },
  orange:  { glow: 'rgba(249,115,22,0.08)',   border: 'rgba(249,115,22,0.15)',  shadow: 'rgba(249,115,22,0.06)' },
  pink:    { glow: 'rgba(236,72,153,0.08)',   border: 'rgba(236,72,153,0.15)',  shadow: 'rgba(236,72,153,0.06)' },
  none:    { glow: 'transparent',             border: 'rgba(255,255,255,0.08)', shadow: 'transparent' },
};

interface DashboardCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  /** Accent color for subtle border glow */
  accent?: AccentColor;
  /** Padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Disable hover lift */
  hoverable?: boolean;
  /** Full height */
  fullHeight?: boolean;
  className?: string;
  children: React.ReactNode;
}

const PADDING_MAP = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

/**
 * Premium 3D Dashboard Card
 *
 * Multi-layered depth system:
 * - Layer 1: Base surface with subtle gradient
 * - Layer 2: Inner top-edge highlight (simulates light source from above)
 * - Layer 3: 3D box-shadow stack (close shadow → mid shadow → far ambient)
 * - Layer 4: Accent-colored border glow
 * - Hover: lift -6px with expanded shadow radius + accent intensification
 */
export const DashboardCard = forwardRef<HTMLDivElement, DashboardCardProps>(
  function DashboardCard(
    { accent = 'none', padding = 'md', hoverable = true, fullHeight = false, className = '', children, style, ...motionProps },
    ref,
  ) {
    const colors = ACCENT_MAP[accent];

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hoverable ? { y: -6, transition: { type: 'spring', stiffness: 400, damping: 25 } } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`
          group/card relative rounded-2xl overflow-hidden
          ${fullHeight ? 'h-full' : ''}
          ${PADDING_MAP[padding]}
          ${className}
        `}
        style={{
          // Base surface — subtle gradient mimics light falloff
          background: `linear-gradient(145deg, rgba(18,20,35,0.95) 0%, rgba(12,13,30,0.98) 50%, rgba(8,10,22,1) 100%)`,
          // Accent-tinted border
          border: `1px solid ${colors.border}`,
          // 3D shadow stack
          boxShadow: [
            // Close shadow — sharp, small offset (contact shadow)
            `0 2px 4px rgba(0,0,0,0.3)`,
            // Mid shadow — softer, medium offset (depth)
            `0 8px 24px rgba(0,0,0,0.35)`,
            // Far shadow — very soft, large offset (ambient occlusion)
            `0 20px 48px rgba(0,0,0,0.2)`,
            // Accent glow — colored ambient light
            `0 0 32px ${colors.shadow}`,
            // Inner top highlight — simulates overhead light
            `inset 0 1px 0 rgba(255,255,255,0.07)`,
            // Inner bottom shadow — adds thickness
            `inset 0 -1px 0 rgba(0,0,0,0.3)`,
          ].join(', '),
          ...style,
        }}
        {...motionProps}
      >
        {/* Top edge light reflection */}
        <div
          className="absolute top-0 left-[8%] right-[8%] h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)`,
          }}
        />

        {/* Accent glow — top-left radial */}
        {accent !== 'none' && (
          <div
            className="absolute -top-12 -left-12 w-48 h-48 pointer-events-none opacity-60 group-hover/card:opacity-100 transition-opacity duration-500"
            style={{
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Bottom-right subtle ambient */}
        <div
          className="absolute -bottom-16 -right-16 w-56 h-56 pointer-events-none opacity-30"
          style={{
            background: `radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)`,
          }}
        />

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  },
);
