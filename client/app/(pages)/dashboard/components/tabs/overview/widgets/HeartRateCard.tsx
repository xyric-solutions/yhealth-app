'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface HeartRateCardProps {
  bpm: number | null;
  restingBpm: number | null;
  minBpm?: number;
  avgBpm?: number;
  maxBpm?: number;
  isLoading?: boolean;
}

const HEART_INNER = "M142.668 14.228C124.946 14.228 109.575 24.427 102.011 39.325C94.447 24.427 79.077 14.228 61.354 14.228C36.141 14.228 15.704 34.876 15.704 60.348C15.704 110.644 102.011 167.663 102.011 167.663C102.011 167.663 188.319 110.644 188.319 60.348C188.319 34.876 167.881 14.228 142.668 14.228Z";
const HEART_OUTER = "M193.206 41.052C190.226 34.151 185.929 27.899 180.555 22.643C175.178 17.372 168.838 13.183 161.88 10.304C154.665 7.307 146.927 5.773 139.114 5.791C128.153 5.791 117.46 8.792 108.166 14.462C105.943 15.818 103.831 17.307 101.83 18.93C99.829 17.307 97.717 15.818 95.494 14.462C86.201 8.792 75.507 5.791 64.546 5.791C56.654 5.791 49.006 7.303 41.78 10.304C34.799 13.194 28.507 17.352 23.105 22.643C17.724 27.893 13.426 34.147 10.455 41.052C7.364 48.233 5.786 55.859 5.786 63.707C5.786 71.11 7.297 78.825 10.299 86.673C12.811 93.231 16.413 100.035 21.015 106.904C28.307 117.776 38.334 129.115 50.784 140.609C71.416 159.662 91.848 172.824 92.715 173.357L97.984 176.737C100.318 178.226 103.32 178.226 105.654 176.737L110.923 173.357C111.79 172.802 132.2 159.662 152.854 140.609C165.304 129.115 175.331 117.776 182.623 106.904C187.225 100.035 190.849 93.231 193.339 86.673C196.34 78.825 197.852 71.11 197.852 63.707C197.874 55.859 196.296 48.233 193.206 41.052Z";
const ECG_PTS = "0,18 55,18 73,18 83,4 93,34 103,4 113,18 133,18 193,18 211,18 221,7 231,31 241,7 251,18 271,18 331,18 349,18 359,7 369,31 379,7 389,18 460,18";

/** Maps BPM (40–180) to SVG Y coordinate for fill level. */
function bpmToFillY(bpm: number | null): number {
  if (!bpm) return 162;
  const pct = 40 + ((Math.max(40, Math.min(180, bpm)) - 40) / 140) * 55;
  return Math.round(170 - (pct / 100) * 160);
}

/** Returns wave SVG d-path of double width (408px) for seamless translateX(-204) loop. */
function wavePath(amp: number, yOffset = 0): string {
  const y = yOffset;
  return `M0,${y} q51,-${amp} 102,0 q51,${amp} 102,0 q51,-${amp} 102,0 q51,${amp} 102,0 V200 H0 Z`;
}

type BpmMeta = { color: string; rgb: string; label: string };
function bpmMeta(bpm: number | null): BpmMeta {
  if (!bpm || bpm < 60) return { color: '#60a5fa', rgb: '96,165,250',   label: 'Low'      };
  if (bpm < 100)        return { color: '#ef4444', rgb: '239,68,68',    label: 'Normal'   };
  if (bpm < 140)        return { color: '#f97316', rgb: '249,115,22',   label: 'Elevated' };
                        return { color: '#a855f7', rgb: '168,85,247',   label: 'High'     };
}

// ─── Injected CSS (animations only, no layout) ────────────────────────────────
const CARD_CSS = `
  @keyframes hr-hb  { 0%,100%{transform:scale(1)} 8%{transform:scale(1.09)} 16%{transform:scale(1)} 26%{transform:scale(1.05)} 38%{transform:scale(1)} }
  @keyframes hr-pr  { 0%{transform:translate(-50%,-50%) scale(0.65);opacity:.55} 100%{transform:translate(-50%,-50%) scale(2.5);opacity:0} }
  @keyframes hr-gb  { 0%,100%{opacity:.44} 50%{opacity:1} }
  @keyframes hr-cg  {
    0%,100%{box-shadow:0 6px 12px rgba(0,0,0,.6),0 20px 48px rgba(0,0,0,.7),0 0 0 1px rgba(239,68,68,.2),0 0 60px rgba(239,68,68,.07),0 0 120px rgba(239,68,68,.03)}
    50%    {box-shadow:0 6px 12px rgba(0,0,0,.6),0 20px 48px rgba(0,0,0,.7),0 0 0 1px rgba(239,68,68,.35),0 0 80px rgba(239,68,68,.22),0 0 140px rgba(239,68,68,.09)}
  }
  @keyframes hr-ecg { 0%{stroke-dashoffset:460;opacity:.9} 78%{opacity:.9} 100%{stroke-dashoffset:0;opacity:0} }
  @keyframes hr-fp  { 0%,100%{opacity:.06} 50%{opacity:.22} }
  @keyframes hr-ss  { 0%{transform:translateX(-120px) skewX(-12deg);opacity:0} 35%{opacity:.1} 100%{transform:translateX(300px) skewX(-12deg);opacity:0} }
  @keyframes hr-dp  { 0%,100%{box-shadow:0 0 8px rgba(239,68,68,.7)} 50%{box-shadow:0 0 16px rgba(239,68,68,1),0 0 32px rgba(239,68,68,.5)} }
`;

export function HeartRateCard({
  bpm,
  restingBpm,
  minBpm  = 58,
  avgBpm  = 74,
  maxBpm  = 124,
  isLoading = false,
}: HeartRateCardProps) {
  const fillGroupRef = useRef<SVGGElement>(null);
  const currentY     = useRef(bpmToFillY(bpm));
  const rafRef       = useRef<number>(0);

  const displayBpm = isLoading ? '--' : (bpm ?? '--');
  const { color, rgb, label } = bpmMeta(bpm);
  const targetFillY = bpmToFillY(bpm);

  // Keep SVG transform off the React tree: a controlled `transform` prop would be
  // re-applied on every parent re-render and overwrite RAF `setAttribute` updates.
  useLayoutEffect(() => {
    const el = fillGroupRef.current;
    if (!el) return;
    el.setAttribute(
      'transform',
      `translate(0,${currentY.current.toFixed(2)})`,
    );
  }, [targetFillY]);

  // ── Smooth RAF-driven fill animation ─────────────────────────────────────────
  // Inline style / framer-motion cannot animate SVG `transform` attribute
  // reliably across browsers, so we drive it with requestAnimationFrame.
  useEffect(() => {
    const target = targetFillY;
    const run = () => {
      const d = target - currentY.current;
      if (Math.abs(d) > 0.15) {
        currentY.current += d * 0.07;
        fillGroupRef.current?.setAttribute(
          'transform',
          `translate(0,${currentY.current.toFixed(2)})`,
        );
        rafRef.current = requestAnimationFrame(run);
      } else {
        currentY.current = target;
        fillGroupRef.current?.setAttribute('transform', `translate(0,${target})`);
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetFillY]);

  // Only show stats when we have real data (not defaults)
  const hasRealStats = minBpm !== 58 || avgBpm !== 74 || maxBpm !== 124;
  const stats: [string, number][] = hasRealStats ? [
    ['Min', minBpm],
    ['Avg', avgBpm],
    ['Max', maxBpm],
  ] : [];

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
          padding: '26px 26px 18px',
          background: 'linear-gradient(148deg,#160f28 0%,#0d0a1c 55%,#090616 100%)',
          animation: 'hr-cg 3s ease-in-out infinite',
        }}
      >
        {/* Top / bottom accent lines */}
        <div className="absolute top-0 left-[8%] right-[8%] h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)' }} />
        <div className="absolute bottom-0 left-[8%] right-[8%] h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(239,68,68,.22),transparent)' }} />

        {/* Ambient glows */}
        <div className="absolute pointer-events-none rounded-full"
          style={{ top:-88,right:-68,width:290,height:290,background:'radial-gradient(circle,rgba(239,68,68,.17) 0%,transparent 65%)',animation:'hr-gb 2.4s ease-in-out infinite' }} />
        <div className="absolute pointer-events-none rounded-full"
          style={{ bottom:-55,left:-45,width:210,height:210,background:'radial-gradient(circle,rgba(139,92,246,.1) 0%,transparent 65%)' }} />

        {/* ── Main content row ── */}
        <div className="relative z-10 flex items-center gap-1">

          {/* LEFT — text */}
          <div className="flex-1 min-w-0">
            {/* Live indicator */}
            <div className="flex items-center gap-[7px] mb-[9px]">
              <span className="w-[7px] h-[7px] rounded-full bg-red-500 shrink-0"
                style={{ animation: 'hr-dp 1.1s ease-in-out infinite' }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                Live Monitor
              </span>
            </div>

            <h3 className="text-[27px] font-extrabold text-white leading-[1.1] tracking-tight mb-[3px]">
              Heart Rate
            </h3>
            <p className="text-[12.5px] text-white/35 mb-[13px]">
              Resting:{' '}
              <span className="text-white/70 font-semibold">{restingBpm ?? '--'} bpm</span>
            </p>

            {/* Status badge */}
            <div
              className="inline-flex items-center gap-[6px] px-3 py-[5px] rounded-full mb-4 text-[11px] font-bold tracking-[0.04em]"
              style={{
                background: `rgba(${rgb},0.12)`,
                border: `1px solid rgba(${rgb},0.32)`,
                color,
              }}
            >
              <span className="w-[5px] h-[5px] rounded-full shrink-0"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              {label}
            </div>

            {/* Min / Avg / Max */}
            <div className="flex items-center gap-0">
              {stats.map(([lbl, val], i) => (
                <div key={lbl} className="flex items-center">
                  {i > 0 && <div className="w-px h-7 mx-[15px]" style={{ background:'rgba(255,255,255,.08)' }} />}
                  <div>
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-white/27 mb-[2px]">{lbl}</div>
                    <div className="text-[16px] font-bold text-white/68 tracking-tight">{val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Heart */}
          <div className="relative shrink-0 flex items-center justify-center"
            style={{ width:178, height:162 }}>
            {/* Pulse rings */}
            {[0, 0.8, 1.6].map((delay, i) => (
              <div key={i} className="absolute pointer-events-none"
                style={{
                  top:'50%', left:'50%',
                  width:128, height:116,
                  borderRadius:'60%',
                  border:`${1.5 - i * 0.4}px solid rgba(239,68,68,${0.22 - i * 0.05})`,
                  animation: `hr-pr 2.4s ease-out ${delay}s infinite`,
                }}
              />
            ))}

            {/* Glow behind heart */}
            <div className="absolute pointer-events-none rounded-full"
              style={{ inset:-30, background:'radial-gradient(circle,rgba(239,68,68,.3) 0%,transparent 65%)', animation:'hr-gb 1.4s ease-in-out infinite' }} />

            {/* Heart SVG */}
            <svg
              width="168" height="152" viewBox="0 0 204 183"
              className="block"
              style={{ animation:'hr-hb 1.4s ease-in-out infinite', filter:'drop-shadow(0 0 22px rgba(239,68,68,.58)) drop-shadow(0 0 8px rgba(239,68,68,.3)) drop-shadow(0 14px 30px rgba(0,0,0,.75))' }}
            >
              <defs>
                <clipPath id="hr-clip"><path d={HEART_INNER} /></clipPath>
                <linearGradient id="hr-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#ff7070" />
                  <stop offset="50%"  stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
                <radialGradient id="hr-hglow" cx="35%" cy="30%" r="65%">
                  <stop offset="0%"   stopColor="rgba(255,110,110,0.18)" />
                  <stop offset="100%" stopColor="rgba(255,110,110,0)" />
                </radialGradient>
                <filter id="hr-fg">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Outer glow shell */}
              <path d={HEART_OUTER} fill="url(#hr-hglow)" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" />
              {/* Dark inner */}
              <path d={HEART_INNER} fill="#090516" />

              {/* ── LIQUID FILL — all children translated by RAF ── */}
              <g clipPath="url(#hr-clip)">
                <g ref={fillGroupRef}>
                  {/* Base gradient */}
                  <rect x="0" y="-14" width="204" height="230" fill="url(#hr-fill)" />
                  {/* Shimmer sweeps */}
                  <rect x="-90" y="-14" width="120" height="230" fill="rgba(255,255,255,0.065)"
                    style={{ animation: 'hr-ss 5s ease-in-out 1s infinite' }} />
                  <rect x="-90" y="-14" width="120" height="230" fill="rgba(255,255,255,0.04)"
                    style={{ animation: 'hr-ss 5s ease-in-out 3.5s infinite' }} />

                  {/* Wave — back layer, slow */}
                  <g>
                    <path d={wavePath(9 * 0.75, 3)} fill="rgba(170,28,28,0.48)" />
                    <animateTransform attributeName="transform" type="translate"
                      from="-204 0" to="0 0" dur="5.8s" repeatCount="indefinite" />
                  </g>
                  {/* Wave — front layer */}
                  <g>
                    <path d={wavePath(9)} fill="rgba(255,85,85,0.3)" />
                    <animateTransform attributeName="transform" type="translate"
                      from="0 0" to="-204 0" dur="3.8s" repeatCount="indefinite" />
                  </g>
                  {/* Wave — foam / top surface */}
                  <g>
                    <path d={wavePath(9 * 0.45, -2)} fill="rgba(255,180,180,0.16)"
                      style={{ animation: 'hr-fp 2.2s ease-in-out infinite' }} />
                    <animateTransform attributeName="transform" type="translate"
                      from="0 0" to="-204 0" dur="2.9s" repeatCount="indefinite" />
                  </g>

                  {/* Top surface highlight */}
                  <rect x="0" y="-14" width="204" height="20" fill="rgba(255,255,255,0.07)" />
                </g>
              </g>

              {/* Glowing inner border (drawn on top of fill) */}
              <path d={HEART_INNER} fill="none" stroke="rgba(255,110,110,0.28)" strokeWidth="2" filter="url(#hr-fg)" />

              {/* BPM text */}
              <text x="102" y="100" textAnchor="middle" fill="white"
                fontSize="35" fontWeight="800" fontFamily="system-ui,sans-serif"
                style={{ filter: 'drop-shadow(0 0 16px rgba(255,255,255,.58)) drop-shadow(0 2px 8px rgba(0,0,0,.9))' }}>
                {displayBpm}
              </text>
              <text x="102" y="120" textAnchor="middle" fill="rgba(255,255,255,0.5)"
                fontSize="12" fontWeight="700" fontFamily="system-ui,sans-serif" letterSpacing="3">
                BPM
              </text>
            </svg>
          </div>
        </div>

        {/* ── ECG Strip ── */}
        <div className="relative z-10 mt-4 pt-[13px]" style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
          <svg width="100%" height="36" viewBox="0 0 460 36" preserveAspectRatio="none">
            {/* Static dim baseline */}
            <polyline points={ECG_PTS} fill="none"
              stroke="rgba(239,68,68,0.15)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
            {/* Animated scanning highlight */}
            <polyline points={ECG_PTS} fill="none"
              stroke="rgba(239,68,68,0.85)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="460"
              style={{ animation: 'hr-ecg 2.8s linear infinite' }} />
          </svg>
        </div>
      </motion.div>
    </>
  );
}