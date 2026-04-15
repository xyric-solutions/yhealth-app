'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import type { Plan } from './types';

// 270-degree arc gauge — no visible track, only the progress arc glows
const GAUGE_R = 62;
const GAUGE_STROKE = 8;
const ARC_DEG = 270;
const ARC_LEN = (ARC_DEG * Math.PI * GAUGE_R) / 180;
const SVG_SIZE = 160;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;

// Arc from 135deg (bottom-left) sweeping 270deg clockwise to 45deg (bottom-right)
function describeArc(cx: number, cy: number, r: number, startAngle: number, sweepDeg: number) {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = ((startAngle + sweepDeg) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

const ARC_PATH = describeArc(CX, CY, GAUGE_R, 135, ARC_DEG);

interface CurrentPlanCardProps {
  plan: Plan;
}

export function CurrentPlanCard({ plan }: CurrentPlanCardProps) {
  const gid = useId();
  const glowId = `${gid}-glow`;
  const progress = Math.min(plan.overallProgress, 100);
  const gaugeOffset = ARC_LEN - (ARC_LEN * progress) / 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      className="group/plan relative rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: 'linear-gradient(160deg, rgba(14,16,33,0.98) 0%, rgba(8,10,24,1) 100%)',
        border: '1px solid rgba(56,189,248,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div className="relative px-6 pt-5 pb-5 flex flex-col items-center text-center">
        {/* Arc gauge */}
        <div className="relative w-[160px] h-[130px]">
          <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} fill="none" className="w-full h-full">
            {/* Very subtle track — barely visible */}
            <path
              d={ARC_PATH}
              stroke="rgba(255,255,255,0.03)"
              strokeWidth={GAUGE_STROKE}
              strokeLinecap="round"
              fill="none"
            />
            {/* Outer glow — wide, blurred */}
            <motion.path
              d={ARC_PATH}
              fill="none"
              stroke="rgba(14,165,233,0.35)"
              strokeWidth={GAUGE_STROKE + 10}
              strokeLinecap="round"
              strokeDasharray={ARC_LEN}
              initial={{ strokeDashoffset: ARC_LEN }}
              animate={{ strokeDashoffset: gaugeOffset }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              style={{ filter: 'blur(10px)' }}
            />
            {/* Inner glow */}
            <motion.path
              d={ARC_PATH}
              fill="none"
              stroke="rgba(56,189,248,0.4)"
              strokeWidth={GAUGE_STROKE + 4}
              strokeLinecap="round"
              strokeDasharray={ARC_LEN}
              initial={{ strokeDashoffset: ARC_LEN }}
              animate={{ strokeDashoffset: gaugeOffset }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              style={{ filter: 'blur(5px)' }}
            />
            {/* Main progress arc */}
            <motion.path
              d={ARC_PATH}
              fill="none"
              stroke={`url(#${gid})`}
              strokeWidth={GAUGE_STROKE}
              strokeLinecap="round"
              strokeDasharray={ARC_LEN}
              initial={{ strokeDashoffset: ARC_LEN }}
              animate={{ strokeDashoffset: gaugeOffset }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
            <defs>
              <linearGradient id={gid} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0369a1" />
                <stop offset="40%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          {/* Text inside the arc — slightly below center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: '12px' }}>
            <motion.span
              className="text-[26px] font-extrabold text-white tabular-nums leading-none"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              style={{ textShadow: '0 0 20px rgba(56,189,248,0.15)' }}
            >
              {progress}%
            </motion.span>
            <span className="text-[10px] text-sky-300/50 font-medium mt-1 tracking-wide">
              Overall Progress
            </span>
          </div>
        </div>

        {/* Plan info */}
        <h3 className="text-base font-bold text-white leading-snug mb-1">{plan.name}</h3>
        <p className="text-xs text-slate-400/80 leading-relaxed line-clamp-2 mb-5 max-w-[220px]">
          {plan.description}
        </p>

        {/* CTA */}
        <Link
          href="/dashboard?tab=plans"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, #059669, #047857)',
            boxShadow: '0 4px 12px rgba(5,150,105,0.3), 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          View Plan Details
          <ChevronRight className="w-4 h-4 group-hover/plan:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
}
