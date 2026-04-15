"use client";

import { useRef, useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Play, Sparkles, Dumbbell, Apple, Brain,
  BookOpen, Target, Heart, Shield, Zap, Cpu,
  Briefcase, DollarSign,
} from "lucide-react";
import { HeroSplineScene } from "./spline/HeroSplineScene";
import { useAuth } from "@/app/context/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────
const DOMAINS = [
  { Icon: Dumbbell,   label: "Fitness",       color: "#f97316", rgb: "249,115,22",  angle: 0   },
  { Icon: Apple,      label: "Nutrition",      color: "#10b981", rgb: "16,185,129",  angle: 45  },
  { Icon: Brain,      label: "Mindfulness",    color: "#a78bfa", rgb: "167,139,250", angle: 90  },
  { Icon: BookOpen,   label: "Journal",        color: "#fbbf24", rgb: "251,191,36",  angle: 135 },
  { Icon: Target,     label: "Habits",         color: "#22d3ee", rgb: "34,211,238",  angle: 180 },
  { Icon: Heart,      label: "Relationships",  color: "#fb7185", rgb: "251,113,133", angle: 225 },
  { Icon: Briefcase,  label: "Career",         color: "#60a5fa", rgb: "96,165,250",  angle: 270 },
  { Icon: DollarSign, label: "Finance",        color: "#bef264", rgb: "190,242,100", angle: 315 },
];

const WORDS    = ["Coached", "Optimized", "Transformed", "Guided"];
// Verified geometry — RY=148 gives 34px gap at top/bottom (no sphere collision)
// Adjacent card spacing at 45° intervals ≈ 111px (card is 82px wide — no overlap)
const ORBIT_RX = 210;  // horizontal radius
const ORBIT_RY = 148;  // vertical radius (independent of RX — no TILT multiplier)

// ─── Injected CSS ─────────────────────────────────────────────────────
const HERO_CSS = `
  .h-root  { font-family:'DM Sans',system-ui,sans-serif; }
  .h-disp  { font-family:'Bricolage Grotesque',system-ui,sans-serif; }
  /* Headline: scoped classes — avoid global .animate-shimmer (globals.css) which collides and breaks bg-clip-text + transforms */
  .h-hero-title {
    font-family: 'Bricolage Grotesque', system-ui, sans-serif;
    line-height: 1.12;
    letter-spacing: -0.035em;
    text-wrap: balance;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .h-hero-line { display: block; padding-bottom: 0.04em; }
  .h-hero-grad-wrap {
    display: block;
    overflow: hidden;
    min-height: 1.12em;
  }
  .h-hero-grad-text {
    display: block;
    padding-bottom: 0.04em;
    background-image: linear-gradient(
      92deg,
      #fde68a 0%,
      #fbbf24 18%,
      #fb923c 42%,
      #f97316 58%,
      #c084fc 82%,
      #a78bfa 100%
    );
    background-size: 200% 100%;
    background-repeat: no-repeat;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
    /* One animation property: shimmer (background-position) + enter (transform) — two rules on one element overwrite each other */
    animation:
      h-shimmer 4s linear infinite,
      h-word-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes h-aurora1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,-40px) scale(1.12)} }
  @keyframes h-aurora2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,30px) scale(0.9)} }
  @keyframes h-breathe { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:.85;transform:scale(1.1)} }
  @keyframes h-pulse   { 0%{transform:scale(1);opacity:.65} 100%{transform:scale(2.9);opacity:0} }
  @keyframes h-spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes h-ping    { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(2.2);opacity:0} }
  @keyframes h-ticker  { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes h-shimmer { from{background-position:-200% 0} to{background-position:200% 0} }
  @keyframes h-word-enter {
    from { opacity: 0; transform: translate3d(0, 100%, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes h-scan    { 0%{transform:translateY(-74px);opacity:0} 12%{opacity:.7} 88%{opacity:.7} 100%{transform:translateY(74px);opacity:0} }
  @keyframes h-fade-up { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
  @keyframes h-orb-glow{ 0%,100%{box-shadow:0 0 80px rgba(14,165,233,.38),0 0 160px rgba(139,92,246,.18),inset 0 0 55px rgba(0,0,0,.85)} 50%{box-shadow:0 0 100px rgba(14,165,233,.48),0 0 200px rgba(139,92,246,.25),inset 0 0 55px rgba(0,0,0,.85)} }

  .h-card-orbit { transition:box-shadow .3s ease; }
  .h-card-orbit:hover { transform:scale(1.18) !important; opacity:1 !important; }

  .h-cta-primary {
    display:inline-flex; align-items:center; gap:8px;
    padding:14px 28px; border-radius:14px;
    font-family:'DM Sans',sans-serif; font-weight:600; font-size:16px;
    color:white; cursor:pointer; border:none; letter-spacing:-.01em;
    background:linear-gradient(135deg,#f97316,#ef4444,#dc2626);
    box-shadow:0 4px 24px rgba(249,115,22,.42),0 2px 8px rgba(0,0,0,.3);
    transition:transform .2s ease,box-shadow .2s ease;
    position:relative; overflow:hidden;
  }
  .h-cta-primary:hover { transform:translateY(-2px); box-shadow:0 8px 36px rgba(249,115,22,.55),0 4px 16px rgba(0,0,0,.4); }
  .h-cta-primary::before {
    content:''; position:absolute; inset:0;
    background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.28) 50%,transparent 60%);
    transform:translateX(-100%); transition:transform .55s ease;
  }
  .h-cta-primary:hover::before { transform:translateX(210%); }

  .h-cta-glass {
    display:inline-flex; align-items:center; gap:8px;
    padding:14px 28px; border-radius:14px;
    font-family:'DM Sans',sans-serif; font-weight:500; font-size:16px;
    color:rgba(255,255,255,.8); cursor:pointer;
    background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.13);
    backdrop-filter:blur(20px);
    transition:all .2s ease;
  }
  .h-cta-glass:hover { background:rgba(255,255,255,.09); border-color:rgba(255,255,255,.26); transform:translateY(-2px); }
`;

// ─── Sphere Component ─────────────────────────────────────────────────
function CentralSphere() {
  return (
    <div style={{ position: "relative", zIndex: 100, flexShrink: 0 }}>
      {/* Outer ambient halo */}
      <div style={{
        position: "absolute", inset: -84, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(14,165,233,.24) 0%, rgba(139,92,246,.13) 45%, transparent 70%)",
        filter: "blur(28px)",
        animation: "h-breathe 6s ease-in-out infinite",
      }} />

      {/* Pulse rings */}
      {[0, 1.5, 3].map((delay, i) => (
        <div key={i} style={{
          position: "absolute", inset: -(20 + i * 6), borderRadius: "50%",
          border: `1px solid rgba(14,165,233,${.36 - i * .07})`,
          animation: `h-pulse 4.6s ease-out ${delay}s infinite`,
        }} />
      ))}

      {/* Spinning conic rim */}
      <div style={{
        position: "absolute", inset: -3, borderRadius: "50%", padding: 2,
        background: "conic-gradient(from 0deg, rgba(14,165,233,.75), rgba(139,92,246,.58), rgba(249,115,22,.48), rgba(14,165,233,.75))",
        animation: "h-spin 6s linear infinite",
      }}>
        <div style={{ borderRadius: "50%", width: "100%", height: "100%", background: "#020209" }} />
      </div>

      {/* Sphere body */}
      <div style={{
        position: "relative", width: 152, height: 152, borderRadius: "50%",
        background: "radial-gradient(circle at 34% 28%, #1c2b4a 0%, #0d1628 50%, #060813 100%)",
        animation: "h-orb-glow 5s ease-in-out infinite",
        overflow: "hidden",
      }}>
        {/* Rotating atmosphere */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "conic-gradient(from 0deg, transparent 0%, rgba(14,165,233,.16) 20%, transparent 38%, rgba(139,92,246,.1) 58%, transparent 75%)",
          animation: "h-spin 9s linear infinite",
        }} />
        {/* Horizontal scan sweep */}
        <div style={{
          position: "absolute", left: 0, right: 0, height: 1, top: "50%", marginTop: -0.5,
          background: "linear-gradient(90deg, transparent, rgba(14,165,233,.65), rgba(14,165,233,.65), transparent)",
          boxShadow: "0 0 12px rgba(14,165,233,.55), 0 0 4px rgba(14,165,233,.95)",
          animation: "h-scan 3.8s ease-in-out infinite",
        }} />
        {/* Specular highlight */}
        <div style={{
          position: "absolute", top: "7%", left: "13%", width: "42%", height: "30%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(255,255,255,.2) 0%, transparent 70%)",
          filter: "blur(4px)", transform: "rotate(-28deg)",
        }} />
        {/* Purple rim light */}
        <div style={{
          position: "absolute", bottom: "4%", right: "4%", width: "44%", height: "44%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(139,92,246,.4) 0%, transparent 70%)",
          filter: "blur(10px)",
        }} />
        {/* Brain icon */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
          <Brain style={{
            width: 58, height: 58,
            color: "rgba(20,215,255,.92)",
            filter: "drop-shadow(0 0 20px rgba(20,215,255,.78)) drop-shadow(0 0 55px rgba(20,215,255,.38))",
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Live Badge ───────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <div style={{ display: "inline-flex" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 18px", borderRadius: 100,
        background: "rgba(0,0,0,.45)",
        border: "1px solid rgba(14,165,233,.25)",
        backdropFilter: "blur(20px)",
      }}>
        <span style={{ position: "relative", display: "flex", width: 8, height: 8, flexShrink: 0 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10b981", animation: "h-ping 1.6s ease-out infinite" }} />
          <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
        </span>
        <span className="h-disp" style={{
          fontSize: 13, fontWeight: 600, letterSpacing: ".02em",
          background: "linear-gradient(90deg, #fbbf24, #14b8a6, #a78bfa)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          Intelligent Life Coach
        </span>
        <Sparkles style={{ width: 13, height: 13, color: "#fbbf24", flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ─── Domain Ticker ────────────────────────────────────────────────────
function DomainTicker() {
  const doubled = [...DOMAINS, ...DOMAINS];
  return (
    <div style={{ overflow: "hidden", position: "relative", maxWidth: 500 }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 52,
        background: "linear-gradient(90deg, #020209, transparent)", zIndex: 2,
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 52,
        background: "linear-gradient(270deg, #020209, transparent)", zIndex: 2,
      }} />
      <div style={{ display: "flex", gap: 10, animation: "h-ticker 24s linear infinite", width: "max-content" }}>
        {doubled.map((d, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 10, flexShrink: 0,
            background: `rgba(${d.rgb},.07)`,
            border: `1px solid rgba(${d.rgb},.18)`,
            backdropFilter: "blur(12px)",
          }}>
            <d.Icon style={{ width: 12, height: 12, color: d.color }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,.72)", whiteSpace: "nowrap" }}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────
export function HeroSection() {
  const [word, setWord]         = useState(0);
  const [wordKey, setWordKey]   = useState(0);
  const [liveCount, setLiveCount] = useState(127);
  const [statVals, setStatVals] = useState([0, 0, 0, 0]);
  const [mouse, setMouse]       = useState({ x: 0, y: 0 });

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef   = useRef<number>(0);
  const angleRef = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);

  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Word rotation
  useEffect(() => {
    const t = setInterval(() => {
      setWord(w => (w + 1) % WORDS.length);
      setWordKey(k => k + 1);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // Live counter
  useEffect(() => {
    const t = setInterval(() => setLiveCount(c => Math.min(999, c + Math.floor(Math.random() * 2))), 4000);
    return () => clearInterval(t);
  }, []);

  // Stat count-up
  useEffect(() => {
    const TARGETS = [150, 97, 4.9, 14];
    const DECS    = [0, 0, 1, 0];
    const start   = Date.now();
    const dur     = 1800;
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setStatVals(TARGETS.map((t, i) => Number((t * e).toFixed(DECS[i]))));
      if (p < 1) requestAnimationFrame(tick);
    };
    const timeout = setTimeout(() => requestAnimationFrame(tick), 600);
    return () => clearTimeout(timeout);
  }, []);

  // 3D orbit RAF
  useEffect(() => {
    const animate = () => {
      angleRef.current += 0.0035;
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const baseRad  = ((DOMAINS[i].angle - 90) * Math.PI) / 180;
        const totalRad = baseRad + angleRef.current;
        const x     = Math.cos(totalRad) * ORBIT_RX;
        const y     = Math.sin(totalRad) * ORBIT_RY;
        const depth = Math.sin(totalRad);
        const scale   = 0.82 + 0.18 * (1 + depth) / 2;
        const opacity = 0.62 + 0.38 * (1 + depth) / 2;
        const zi      = Math.round(1 + ((1 + depth) / 2) * 99);
        card.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale.toFixed(3)})`;
        card.style.opacity   = opacity.toFixed(3);
        card.style.zIndex    = String(zi);
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Mouse parallax
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const r = sectionRef.current?.getBoundingClientRect();
    if (!r) return;
    setMouse({
      x: ((e.clientX - r.left) / r.width  - 0.5) * 28,
      y: ((e.clientY - r.top)  / r.height - 0.5) * 18,
    });
  }, []);

  const STATS = [
    { v: statVals[0], s: "K+", l: "Lives Coached"   },
    { v: statVals[1], s: "%",  l: "Goal Completion"  },
    { v: statVals[2], s: "★",  l: "User Rating"      },
    { v: statVals[3], s: "+",  l: "Life Domains"     },
  ];

  return (
    <>
      <style>{HERO_CSS}</style>

      <section
        ref={sectionRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMouse({ x: 0, y: 0 })}
        className="h-root"
        style={{
          minHeight: "100vh",
          background: "#020209",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 0 160px",
        }}
      >
        {/* ── Background ── */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          {/* Aurora 1 */}
          <div style={{
            position: "absolute", top: "-15%", left: "-15%", width: "65%", height: "70%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(14,165,233,.1) 0%, rgba(99,102,241,.07) 40%, transparent 70%)",
            filter: "blur(80px)",
            animation: "h-aurora1 20s ease-in-out infinite",
          }} />
          {/* Aurora 2 */}
          <div style={{
            position: "absolute", bottom: "-10%", right: "-5%", width: "55%", height: "60%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(139,92,246,.08) 0%, rgba(249,115,22,.05) 40%, transparent 70%)",
            filter: "blur(100px)",
            animation: "h-aurora2 24s ease-in-out infinite",
          }} />
          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(rgba(20,210,255,.03) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 65% 40%, black 0%, transparent 62%)",
            WebkitMaskImage: "radial-gradient(ellipse at 65% 40%, black 0%, transparent 62%)",
          }} />
          {/* Vignette */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at center, transparent 35%, rgba(2,2,9,.75) 100%)",
          }} />
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(14,165,233,.55), rgba(139,92,246,.38), transparent)",
          }} />
        </div>

        {/* ── Main Grid ── */}
        <div style={{
          maxWidth: 1300,
          margin: "0 auto",
          padding: "0 52px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 48,
          alignItems: "center",
          position: "relative",
          zIndex: 10,
          width: "100%",
        }}>
          {/* LEFT: Content */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 26,
            animation: "h-fade-up .7s ease forwards",
          }}>
            <LiveBadge />

            {/* Headline — gradient word uses .h-hero-grad-text (not global animate-shimmer) */}
            {/* <div className="flex flex-col gap-0.5">
  <h1 className="h-hero-title m-0 text-[clamp(2.75rem,5.5vw,4.875rem)] font-extrabold text-white/93">
    
    <span className="block h-hero-line">Your Life,</span>
    
    <span className="block h-hero-line">Intelligently</span>
    
    <span
      className="block h-hero-line h-hero-grad-wrap"
      aria-live="polite"
    >
      <span key={wordKey} className="h-hero-grad-text">
        {WORDS[word]}
      </span>
    </span>

  </h1>
</div> */}

            {/* Subtitle */}
            <p style={{
              fontSize: 17, lineHeight: 1.72,
              color: "rgba(255,255,255,.47)",
              maxWidth: 460, margin: 0,
              letterSpacing: "-.01em", fontWeight: 300,
            }}>
              AI that coaches your{" "}
              <span style={{ color: "#f97316", fontWeight: 500 }}>fitness</span>,{" "}
              <span style={{ color: "#10b981", fontWeight: 500 }}>nutrition</span>,{" "}
              <span style={{ color: "#60a5fa", fontWeight: 500 }}>career</span>,{" "}
              <span style={{ color: "#fb7185", fontWeight: 500 }}>relationships</span>, and{" "}
              <span style={{ color: "#a78bfa", fontWeight: 500 }}>more</span> — one AI, every dimension of you.
            </p>

            <DomainTicker />

            {/* CTAs */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {isAuthenticated ? (
                <button className="h-cta-primary" onClick={() => router.push("/dashboard")}>
                  Go to Dashboard <ArrowRight style={{ width: 18, height: 18 }} />
                </button>
              ) : (
                <>
                  <Link href="/auth/signup" className="h-cta-primary" style={{ textDecoration: "none" }}>
                    Start Your Journey <ArrowRight style={{ width: 18, height: 18 }} />
                  </Link>
                  <button className="h-cta-glass">
                    <Play style={{ width: 15, height: 15 }} /> See It in Action
                  </button>
                </>
              )}
            </div>

            {/* Trust indicators */}
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              {[
                { Icon: Shield,   label: "HIPAA Compliant", c: "#10b981" },
                { Icon: Zap,      label: "60-sec Setup",    c: "#fbbf24" },
                { Icon: Cpu,      label: "AI-Powered",      c: "#a78bfa" },
              ].map(({ Icon, label, c }) => (
                <span key={label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, color: "rgba(255,255,255,.38)", letterSpacing: ".02em",
                }}>
                  <Icon style={{ width: 13, height: 13, color: c }} /> {label}
                </span>
              ))}
            </div>

            {/* Live counter */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 8,
                background: "rgba(16,185,129,.08)",
                border: "1px solid rgba(16,185,129,.2)",
              }}>
                <span style={{ position: "relative", display: "flex", width: 8, height: 8 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10b981", animation: "h-ping 1.6s ease-out infinite" }} />
                  <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                </span>
                <span className="h-disp" style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>
                  {liveCount} active
                </span>
              </div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.35)" }}>
                users improving right now
              </span>
            </div>
          </div>

          {/* RIGHT: 3D Orb */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 560, position: "relative" }}>
            {/* Spline 3D background layer */}
            <div style={{ position: "absolute", inset: -40, zIndex: 0, opacity: 0.85 }}>
              <HeroSplineScene />
            </div>
            <div
              style={{
                position: "relative",
                width: 520, height: 520,
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: `perspective(1200px) rotateX(${-mouse.y * 0.25}deg) rotateY(${mouse.x * 0.25}deg)`,
                transition: "transform .08s ease",
              }}
            >
              {/* Decorative orbit ellipse */}
              <div style={{
                position: "absolute",
                width: 478, height: 236,
                borderRadius: "50%",
                border: "1px solid rgba(14,165,233,.07)",
                pointerEvents: "none",
              }} />

              {/* Orbit cards */}
              {DOMAINS.map((domain, i) => (
                <div
                  key={domain.label}
                  ref={el => { cardRefs.current[i] = el; }}
                  className="h-card-orbit"
                  style={{
                    position: "absolute",
                    left: "50%", top: "50%",
                    width: 94, height: 94,
                    willChange: "transform, opacity",
                  }}
                >
                  <div style={{
                    width: "100%", height: "100%",
                    borderRadius: 22,
                    background: `linear-gradient(145deg, rgba(${domain.rgb},.15) 0%, rgba(5,5,20,.9) 100%)`,
                    border: `1px solid rgba(${domain.rgb},.25)`,
                    backdropFilter: "blur(24px)",
                    boxShadow: `0 0 32px rgba(${domain.rgb},.18), 0 24px 60px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.09)`,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 9, position: "relative", overflow: "hidden",
                  }}>
                    {/* Top sheen */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: "45%",
                      background: `linear-gradient(180deg, rgba(${domain.rgb},.09) 0%, transparent 100%)`,
                    }} />
                    {/* Icon */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, position: "relative", zIndex: 1,
                      background: `linear-gradient(135deg, rgba(${domain.rgb},.3) 0%, rgba(${domain.rgb},.07) 100%)`,
                      boxShadow: `0 4px 16px rgba(${domain.rgb},.28), inset 0 1px 0 rgba(255,255,255,.12)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <domain.Icon style={{
                        width: 19, height: 19,
                        color: domain.color,
                        filter: `drop-shadow(0 0 7px ${domain.color}bb)`,
                      }} />
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: domain.color,
                      letterSpacing: ".05em",
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      position: "relative", zIndex: 1,
                    }}>
                      {domain.label}
                    </span>
                  </div>
                </div>
              ))}

              {/* Sphere sits at z-index 50 — cards range 1-100, passing in front/behind */}
              <div style={{ position: "relative", zIndex: 50 }}>
                <CentralSphere />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div style={{
          position: "absolute", bottom: 32, left: 0, right: 0,
          padding: "0 52px", zIndex: 20,
        }}>
          <div style={{
            maxWidth: 780, margin: "0 auto",
            display: "flex",
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 20,
            backdropFilter: "blur(32px)",
            overflow: "hidden",
          }}>
            {STATS.map((stat, i) => (
              <div key={stat.l} style={{
                flex: 1, padding: "20px 24px", textAlign: "center",
                borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
              }}>
                <div className="h-disp" style={{
                  fontSize: 30, fontWeight: 700,
                  color: "rgba(255,255,255,.9)",
                  letterSpacing: "-.025em", lineHeight: 1,
                }}>
                  {stat.v}{stat.s}
                </div>
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,.33)",
                  marginTop: 6, letterSpacing: ".06em",
                  textTransform: "uppercase", fontWeight: 500,
                }}>
                  {stat.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 20,
        }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.25)", letterSpacing: ".18em", textTransform: "uppercase" }}>
            Scroll
          </span>
          <div style={{
            width: 22, height: 36, borderRadius: 11,
            border: "1px solid rgba(255,255,255,.15)",
            display: "flex", justifyContent: "center", paddingTop: 6,
          }}>
            <div style={{
              width: 4, height: 8, borderRadius: 2,
              background: "rgba(14,165,233,.7)",
              animation: "h-scan 1.8s ease-in-out infinite",
            }} />
          </div>
        </div>
      </section>
    </>
  );
}

export default HeroSection;