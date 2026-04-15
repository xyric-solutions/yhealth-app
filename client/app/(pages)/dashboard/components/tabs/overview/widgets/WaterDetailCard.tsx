'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useMemo } from 'react';

interface WaterDetailCardProps {
  glasses: number;
  targetGlasses: number;
  mlConsumed: number;
  targetMl: number;
  streak?: number;
  lastDrinkMinutes?: number;
  onAddGlass?: () => void;
  onRemoveGlass?: () => void;
  isUpdating?: boolean;
}

const FILL_BOTTOM = 210;
const FILL_TOP    = 10;
const FILL_RANGE  = FILL_BOTTOM - FILL_TOP; // 200

function glassToFillY(glasses: number, target: number): number {
  if (glasses <= 0) return FILL_BOTTOM + 18; // below clip = empty
  if (glasses >= target) return FILL_TOP;
  return Math.round(FILL_BOTTOM - (glasses / target) * FILL_RANGE);
}

const CARD_CSS = `
  @keyframes wc-cg {
    0%,100%{box-shadow:0 6px 12px rgba(0,0,0,.6),0 20px 48px rgba(0,0,0,.7),0 0 0 1px rgba(6,182,212,.2),0 0 60px rgba(6,182,212,.07)}
    50%    {box-shadow:0 6px 12px rgba(0,0,0,.6),0 20px 48px rgba(0,0,0,.7),0 0 0 1px rgba(6,182,212,.36),0 0 80px rgba(6,182,212,.27),0 0 140px rgba(6,182,212,.1)}
  }
  @keyframes wc-gb  { 0%,100%{opacity:.42} 50%{opacity:1} }
  @keyframes wc-fp  { 0%,100%{opacity:.07} 50%{opacity:.26} }
  @keyframes wc-ss  { 0%{transform:translateX(-80px) skewX(-12deg);opacity:0} 35%{opacity:.09} 100%{transform:translateX(160px) skewX(-12deg);opacity:0} }
  @keyframes wc-dp  { 0%,100%{box-shadow:0 0 6px rgba(6,182,212,.65)} 50%{box-shadow:0 0 14px rgba(6,182,212,1),0 0 28px rgba(6,182,212,.5)} }
  @keyframes wc-pr  { 0%{transform:translate(-50%,-50%) scale(.7);opacity:.5} 100%{transform:translate(-50%,-50%) scale(2.4);opacity:0} }
`;

// ─── Mini glass icon ──────────────────────────────────────────────────
function GlassIcon({ filled, index }: { filled: boolean; index: number }) {
  const clipId = `wgi-${index}`;
  return (
    <motion.svg
      viewBox="0 0 24 32"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.25 }}
      style={{
        width: filled ? 23 : 20,
        height: filled ? 31 : 27,
        flexShrink: 0,
        filter: filled ? 'drop-shadow(0 0 5px rgba(6,182,212,0.55))' : 'none',
        transition: 'all .3s ease',
      }}
    >
      {/* Glass body */}
      <path d="M4,2 L20,2 L17.5,28 Q17.5,30 16,30 L8,30 Q6.5,30 6.5,28 Z"
        fill={filled ? 'rgba(6,182,212,0.18)' : 'rgba(255,255,255,0.03)'}
        stroke={filled ? 'rgba(34,211,238,0.65)' : 'rgba(255,255,255,0.11)'}
        strokeWidth={filled ? 1.3 : 0.8} />
      {filled && (
        <>
          <defs>
            <clipPath id={clipId}>
              <path d="M4,2 L20,2 L17.5,28 Q17.5,30 16,30 L8,30 Q6.5,30 6.5,28 Z" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect y="10" width="24" height="22" fill="rgba(6,182,212,0.76)" />
            <path d="M4,10 Q12,13.5 20,10 L20,12 Q12,15.5 4,12 Z" fill="rgba(103,232,249,0.65)" />
          </g>
          {/* Left-side shine */}
          <path d="M5,2 L6.2,2 L5.6,28 Q5.5,30 5.8,29 Z" fill="rgba(255,255,255,0.14)" />
          {/* Rim highlight */}
          <path d="M4,2 L20,2" stroke="rgba(186,230,253,0.75)" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
    </motion.svg>
  );
}

// ─── Water Glass SVG ──────────────────────────────────────────────────
function WaterGlass({ fillGroupRef }: { fillGroupRef: React.RefObject<SVGGElement | null> }) {
  return (
    <svg
      width="126" height="170" viewBox="0 0 126 214"
      style={{
        display: 'block',
        overflow: 'visible',
        filter: 'drop-shadow(0 0 22px rgba(6,182,212,.58)) drop-shadow(0 14px 30px rgba(0,0,0,.76))',
      }}
    >
      <defs>
        <clipPath id="wc-gc">
          <path d="M16,10 L110,10 L95,202 Q95,210 86,210 L40,210 Q31,210 31,202 Z" />
        </clipPath>
        <linearGradient id="wc-wfg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#67e8f9" />
          <stop offset="40%"  stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0c4a6e" />
        </linearGradient>
        <linearGradient id="wc-gsg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(103,232,249,0.09)" />
          <stop offset="50%"  stopColor="rgba(103,232,249,0.04)" />
          <stop offset="100%" stopColor="rgba(103,232,249,0.09)" />
        </linearGradient>
        <linearGradient id="wc-shn" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="wc-wgf">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="wc-wof">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Outer glass glow shell */}
      <path d="M14,8 L112,8 L97,204 Q97,212 87,212 L39,212 Q29,212 29,204 Z"
        fill="url(#wc-gsg)" stroke="rgba(6,182,212,0.38)" strokeWidth="1.5" filter="url(#wc-wof)" />

      {/* Dark interior */}
      <g clipPath="url(#wc-gc)">
        <rect width="126" height="214" fill="#03080e" />
      </g>

      {/* ── LIQUID FILL — RAF-driven ── */}
      <g clipPath="url(#wc-gc)">
        <g ref={fillGroupRef} transform={`translate(0,${FILL_BOTTOM + 18})`}>
          {/* Base gradient */}
          <rect x="0" y="-12" width="126" height="235" fill="url(#wc-wfg)" />
          {/* Shimmer sweeps */}
          <rect x="-80" y="-12" width="96" height="235" fill="rgba(255,255,255,0.07)"
            style={{ animation: 'wc-ss 5s ease-in-out .5s infinite' }} />
          <rect x="-80" y="-12" width="96" height="235" fill="rgba(255,255,255,0.04)"
            style={{ animation: 'wc-ss 5s ease-in-out 3s infinite' }} />
          {/* Wave back — slow */}
          <g>
            <path d="M0,0 q31,-8 63,0 q32,8 63,0 q31,-8 63,0 q32,8 63,0 V235 H0 Z" fill="rgba(7,89,133,0.55)" />
            <animateTransform attributeName="transform" type="translate" from="-126 0" to="0 0" dur="5.5s" repeatCount="indefinite" />
          </g>
          {/* Wave front */}
          <g>
            <path d="M0,0 q31,-6 63,0 q32,6 63,0 q31,-6 63,0 q32,6 63,0 V235 H0 Z" fill="rgba(34,211,238,0.3)" />
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-126 0" dur="3.8s" repeatCount="indefinite" />
          </g>
          {/* Foam surface */}
          <g>
            <path d="M0,-2 q31,-4 63,0 q32,4 63,0 q31,-4 63,0 q32,4 63,0 V7 H0 Z"
              fill="rgba(186,230,253,0.22)" style={{ animation: 'wc-fp 2.2s ease-in-out infinite' }} />
            <animateTransform attributeName="transform" type="translate" from="0 0" to="-126 0" dur="2.8s" repeatCount="indefinite" />
          </g>
          {/* Top highlight */}
          <rect x="0" y="-12" width="126" height="17" fill="rgba(255,255,255,0.07)" />
          {/* ── Rising bubbles (SVG animateTransform for cross-browser reliability) ── */}
          <circle cx="27" cy="90" r="3" fill="rgba(255,255,255,0.2)">
            <animateTransform attributeName="transform" type="translate" values="0,0;5,-60;-3,-120;2,-178" keyTimes="0;.3;.7;1" dur="4s" repeatCount="indefinite" begin="0s" />
            <animate attributeName="opacity" values="0;0;.22;.22;0" keyTimes="0;.05;.1;.88;1" dur="4s" repeatCount="indefinite" begin="0s" />
          </circle>
          <circle cx="68" cy="118" r="2" fill="rgba(255,255,255,0.16)">
            <animateTransform attributeName="transform" type="translate" values="0,0;-4,-55;3,-110;-1,-162" keyTimes="0;.3;.7;1" dur="3.6s" repeatCount="indefinite" begin="0.8s" />
            <animate attributeName="opacity" values="0;0;.18;.18;0" keyTimes="0;.05;.1;.88;1" dur="3.6s" repeatCount="indefinite" begin="0.8s" />
          </circle>
          <circle cx="47" cy="100" r="2.5" fill="rgba(255,255,255,0.18)">
            <animateTransform attributeName="transform" type="translate" values="0,0;3,-65;-2,-130;1,-180" keyTimes="0;.3;.7;1" dur="5s" repeatCount="indefinite" begin="1.5s" />
            <animate attributeName="opacity" values="0;0;.2;.2;0" keyTimes="0;.05;.1;.88;1" dur="5s" repeatCount="indefinite" begin="1.5s" />
          </circle>
          <circle cx="88" cy="138" r="1.5" fill="rgba(255,255,255,0.13)">
            <animateTransform attributeName="transform" type="translate" values="0,0;-3,-50;2,-100;-1,-150" keyTimes="0;.3;.7;1" dur="3s" repeatCount="indefinite" begin="2.2s" />
            <animate attributeName="opacity" values="0;0;.15;.15;0" keyTimes="0;.05;.1;.88;1" dur="3s" repeatCount="indefinite" begin="2.2s" />
          </circle>
          <circle cx="37" cy="148" r="2" fill="rgba(255,255,255,0.15)">
            <animateTransform attributeName="transform" type="translate" values="0,0;4,-60;-2,-120;2,-170" keyTimes="0;.3;.7;1" dur="4.5s" repeatCount="indefinite" begin="3s" />
            <animate attributeName="opacity" values="0;0;.18;.18;0" keyTimes="0;.05;.1;.88;1" dur="4.5s" repeatCount="indefinite" begin="3s" />
          </circle>
        </g>
      </g>

      {/* Left-side reflection */}
      <g clipPath="url(#wc-gc)">
        <rect x="16" y="10" width="34" height="200" fill="url(#wc-shn)" />
      </g>

      {/* Top rim highlight */}
      <line x1="14" y1="8" x2="112" y2="8"
        stroke="rgba(186,230,253,0.62)" strokeWidth="2.2" strokeLinecap="round" filter="url(#wc-wgf)" />
      {/* Glowing glass outline */}
      <path d="M14,8 L112,8 L97,204 Q97,212 87,212 L39,212 Q29,212 29,204 Z"
        fill="none" stroke="rgba(6,182,212,0.48)" strokeWidth="1.5" filter="url(#wc-wgf)" />
    </svg>
  );
}

// ─── Water Detail Card ────────────────────────────────────────────────
export function WaterDetailCard({
  glasses,
  targetGlasses,
  mlConsumed,
  targetMl,
  streak          = 4,
  lastDrinkMinutes = 14,
  onAddGlass,
  onRemoveGlass,
  isUpdating = false,
}: WaterDetailCardProps) {
  const fillGroupRef = useRef<SVGGElement>(null);
  const currentY     = useRef(FILL_BOTTOM + 18);
  const rafRef       = useRef<number>(0);

  const progress   = Math.min((mlConsumed / targetMl) * 100, 100);
  const isGoalMet  = glasses >= targetGlasses;
  const pct        = Math.round((glasses / targetGlasses) * 100);
  const remaining  = Math.max(0, targetMl - mlConsumed);

  const { badgeColor, badgeRgb, badgeLabel } = useMemo(() => {
    if (isGoalMet)              return { badgeColor: '#10b981', badgeRgb: '16,185,129',  badgeLabel: 'Goal Met!'       };
    if (glasses >= targetGlasses * 0.5) return { badgeColor: '#06b6d4', badgeRgb: '6,182,212',   badgeLabel: 'Good Progress'   };
    return                             { badgeColor: '#fbbf24', badgeRgb: '251,191,36',  badgeLabel: 'Stay Hydrated'   };
  }, [glasses, targetGlasses, isGoalMet]);

  // ── Smooth fill animation via RAF ─────────────────────────────────────
  useEffect(() => {
    const target = glassToFillY(glasses, targetGlasses);
    const run = () => {
      const d = target - currentY.current;
      if (Math.abs(d) > 0.15) {
        currentY.current += d * 0.08;
        fillGroupRef.current?.setAttribute('transform', `translate(0,${currentY.current.toFixed(2)})`);
        rafRef.current = requestAnimationFrame(run);
      } else {
        currentY.current = target;
        fillGroupRef.current?.setAttribute('transform', `translate(0,${target})`);
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(rafRef.current);
  }, [glasses, targetGlasses]);

  return (
    <>
      <style>{CARD_CSS}</style>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5, transition: { type: 'spring', stiffness: 380, damping: 24 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative overflow-hidden rounded-[28px] cursor-pointer"
        style={{
          padding: '22px 22px 18px',
          background: 'linear-gradient(148deg,#0a1422 0%,#070c1a 55%,#040810 100%)',
          animation: 'wc-cg 3s ease-in-out infinite',
        }}
      >
        {/* Top / bottom accent lines */}
        <div className="absolute top-0 left-[8%] right-[8%] h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)' }} />
        <div className="absolute bottom-0 left-[8%] right-[8%] h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(6,182,212,.22),transparent)' }} />

        {/* Ambient glows */}
        <div className="absolute pointer-events-none rounded-full"
          style={{ top:-80,right:-60,width:280,height:280,background:'radial-gradient(circle,rgba(6,182,212,.17) 0%,transparent 65%)',animation:'wc-gb 2.8s ease-in-out infinite' }} />
        <div className="absolute pointer-events-none rounded-full"
          style={{ bottom:-60,left:-40,width:200,height:200,background:'radial-gradient(circle,rgba(14,116,144,.1) 0%,transparent 65%)' }} />

        {/* ── Title + badge ── */}
        <div className="relative z-10 flex items-center justify-between mb-[14px]">
          <div className="flex items-center gap-[7px]">
            <span className="w-[7px] h-[7px] rounded-full bg-cyan-500 shrink-0"
              style={{ animation: 'wc-dp 1.3s ease-in-out infinite' }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/33">Water Intake</span>
          </div>
          <div className="inline-flex items-center gap-[6px] px-[11px] py-[5px] rounded-full text-[11px] font-bold tracking-[0.04em]"
            style={{ background:`rgba(${badgeRgb},0.12)`, border:`1px solid rgba(${badgeRgb},0.3)`, color:badgeColor }}>
            <span className="w-[5px] h-[5px] rounded-full shrink-0"
              style={{ background:badgeColor, boxShadow:`0 0 6px ${badgeColor}` }} />
            {badgeLabel}
          </div>
        </div>

        {/* ── Main content row ── */}
        <div className="relative z-10 flex items-center gap-2">

          {/* LEFT */}
          <div className="flex-1 min-w-0">
            {/* Count + controls */}
            <div className="flex items-center gap-[10px] mb-[6px]">
              <motion.button
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                onClick={onRemoveGlass}
                disabled={isUpdating || glasses <= 0}
                className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', cursor:'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </motion.button>

              <div>
                <div className="flex items-baseline gap-1 leading-none">
                  <span className="text-[48px] font-extrabold text-white tracking-tight leading-none tabular-nums"
                    style={{ filter:'drop-shadow(0 0 14px rgba(6,182,212,.42))' }}>
                    {glasses}
                  </span>
                  <span className="text-[16px] text-white/35 font-medium">/{targetGlasses}</span>
                </div>
                <div className="text-[11.5px] text-white/30 mt-[1px]">glasses today</div>
              </div>

              <motion.button
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                onClick={onAddGlass}
                disabled={isUpdating}
                className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background:'rgba(6,182,212,.2)', border:'1px solid rgba(6,182,212,.4)', cursor:'pointer', boxShadow:'0 0 12px rgba(6,182,212,.22)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </motion.button>
            </div>

            {/* ml display */}
            <p className="text-[13px] text-white/38 mb-[12px]">
              <span className="text-white/72 font-semibold">{Math.round(mlConsumed).toLocaleString()}</span>
              {' '}/ {targetMl.toLocaleString()} ml
            </p>

            {/* Progress bar */}
            <div className="mb-[14px]">
              <div className="flex justify-between items-center mb-[5px]">
                <span className="text-[10px] uppercase tracking-[0.09em] text-white/26">Daily Goal</span>
                <span className="text-[10px] font-bold" style={{ color:'rgba(6,182,212,.9)' }}>{pct}%</span>
              </div>
              <div className="h-[4px] rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  style={{ background:'linear-gradient(90deg,#22d3ee,#06b6d4)', boxShadow:'0 0 8px rgba(6,182,212,.65)' }}
                />
              </div>
            </div>

            
          </div>

          {/* RIGHT — Water glass */}
          <div className="relative shrink-0 flex items-center justify-center"
            style={{ width: 148, height: 182 }}>
            {/* Pulse rings */}
            {[0, 0.9].map((d, i) => (
              <div key={i} className="absolute pointer-events-none"
                style={{
                  top:'50%', left:'50%', width:108, height:196, borderRadius:'40%',
                  border:`${1.5 - i * 0.5}px solid rgba(6,182,212,${0.2 - i * 0.08})`,
                  animation:`wc-pr 2.8s ease-out ${d}s infinite`,
                }}
              />
            ))}
            {/* Glow behind glass */}
            <div className="absolute pointer-events-none rounded-full"
              style={{ inset:-18, background:'radial-gradient(circle,rgba(6,182,212,.33) 0%,transparent 65%)', animation:'wc-gb 2s ease-in-out infinite' }} />

            <WaterGlass fillGroupRef={fillGroupRef} />
          </div>
        </div>

        {/* ── Glass icons row ── */}
        <div className="relative z-10 mt-4 pt-[13px] flex items-end justify-center gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
          {Array.from({ length: Math.min(targetGlasses, 10) }, (_, i) => {
            const scaledFilled = targetGlasses > 10
              ? Math.round((glasses / targetGlasses) * 10)
              : glasses;
            return <GlassIcon key={i} filled={i < scaledFilled} index={i} />;
          })}
        </div>
      </motion.div>
    </>
  );
}