'use client';

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  /** Accent glow color (hex) — radial glow on top-left */
  glowColor?: string;
  /** Enable hover lift + border brighten */
  hoverable?: boolean;
  /** Additional CSS classes */
  className?: string;
  children: React.ReactNode;
}

/**
 * Premium glassmorphic card — the foundational surface for the bioluminescent dashboard.
 *
 * Features:
 * - backdrop-filter blur(20px)
 * - Luminous border (rgba white 8%)
 * - Inner glow on hover (box-shadow spread)
 * - Hover: y -4px, border brightens (150ms spring)
 * - Optional accent glow (top-left radial gradient)
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard({ glowColor, hoverable = true, className = '', children, ...motionProps }, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hoverable ? { y: -4 } : undefined}
        whileTap={hoverable ? { scale: 0.99 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`relative rounded-2xl overflow-hidden ${className}`}
        style={{
          background: 'var(--yh-surface, #0F1419)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          ...(motionProps.style || {}),
        }}
        {...motionProps}
      >
        {/* ── accent glow ── */}
        {glowColor && (
          <div
            className="absolute top-0 left-0 w-3/4 h-3/4 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 15% 15%, ${glowColor}14 0%, transparent 70%)`,
            }}
          />
        )}

        {/* ── top edge highlight ── */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)`,
          }}
        />

        {/* ── content ── */}
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  },
);
