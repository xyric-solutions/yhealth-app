"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import {
  Check,
  X,
  Minus,
  Brain,
  Activity,
  HeartPulse,
  Crown,
  Sparkles,
  ChevronDown,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

// ─── Data ────────────────────────────────────────────────────────────
type CellValue = boolean | string;

interface FeatureRow {
  feature: string;
  balencia: CellValue;
  generic: CellValue;
  whoop: CellValue;
  calorie: CellValue;
  bevel: CellValue;
}

interface Category {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  rows: FeatureRow[];
}

const categories: Category[] = [
  {
    name: "AI & Coaching",
    icon: Brain,
    color: "from-purple-500 to-primary",
    rows: [
      { feature: "AI personalization", balencia: true, generic: false, whoop: "Limited", calorie: false, bevel: "Limited" },
      { feature: "Proactive AI coaching (AI initiates)", balencia: true, generic: false, whoop: false, calorie: false, bevel: false },
      { feature: "Voice AI coach", balencia: true, generic: false, whoop: false, calorie: false, bevel: "Some" },
    ],
  },
  {
    name: "Life Coaching & Goals",
    icon: Trophy,
    color: "from-amber-500 to-orange-500",
    rows: [
      { feature: "Life goal decomposition by AI", balencia: true, generic: false, whoop: false, calorie: false, bevel: false },
      { feature: "Motivation-based personalization", balencia: true, generic: false, whoop: false, calorie: false, bevel: false },
      { feature: "Cross-domain coaching (career, finance, etc.)", balencia: true, generic: false, whoop: false, calorie: false, bevel: false },
    ],
  },
  {
    name: "Fitness & Activity",
    icon: Activity,
    color: "from-orange-500 to-red-500",
    rows: [
      { feature: "Exercise library & workouts", balencia: true, generic: true, whoop: "Limited", calorie: false, bevel: "Some" },
      { feature: "Wearable sync & recovery insights", balencia: true, generic: "Some", whoop: true, calorie: "Some", bevel: "Limited" },
    ],
  },
  {
    name: "Wellbeing & Life Domains",
    icon: HeartPulse,
    color: "from-green-500 to-emerald-500",
    rows: [
      { feature: "Diet & meal plans", balencia: true, generic: "Some", whoop: false, calorie: true, bevel: "Some" },
      { feature: "Mood tracking & journaling", balencia: true, generic: "Some", whoop: "Limited", calorie: false, bevel: "Some" },
      { feature: "Unified fitness + nutrition + wellbeing + life", balencia: true, generic: false, whoop: false, calorie: "Nutrition only", bevel: "Limited" },
    ],
  },
];

const allRows = categories.flatMap((c) => c.rows);
const TOTAL = allRows.length;

function countTrue(key: keyof FeatureRow) {
  return allRows.filter((r) => r[key] === true).length;
}

const competitors = [
  { key: "balencia" as const, name: "Balencia", score: TOTAL, highlight: true },
  { key: "generic" as const, name: "Generic Apps", score: countTrue("generic") },
  { key: "whoop" as const, name: "WHOOP", score: countTrue("whoop") },
  { key: "calorie" as const, name: "Calorie Apps", score: countTrue("calorie") },
  { key: "bevel" as const, name: "Bevel", score: countTrue("bevel") },
];

// ─── Animated Counter ────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {count}{suffix}
    </span>
  );
}

// ─── Score Bar ───────────────────────────────────────────────────────
function ScoreBar({ score, total, highlight }: { score: number; total: number; highlight?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const pct = Math.round((score / total) * 100);

  return (
    <div ref={ref} className="relative w-full">
      <div className={cn(
        "h-2 rounded-full overflow-hidden",
        highlight ? "bg-primary/20" : "bg-white/[0.07]"
      )}>
        <motion.div
          className={cn(
            "h-full rounded-full",
            highlight
              ? "bg-gradient-to-r from-primary to-emerald-400"
              : "bg-white/20"
          )}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${pct}%` } : { width: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: highlight ? 0 : 0.3 }}
        />
      </div>
    </div>
  );
}

// ─── Cell Component ──────────────────────────────────────────────────
function Cell({ value, isBalenciaCol }: { value: CellValue; isBalenciaCol?: boolean }) {
  if (value === true) {
    return (
      <td className={cn("p-3 sm:p-4 text-center", isBalenciaCol && "bg-primary/[0.04]")}>
        <span
          className={cn(
            "inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-colors",
            isBalenciaCol
              ? "bg-primary/20 text-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]"
              : "bg-primary/15 text-primary"
          )}
        >
          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
        </span>
      </td>
    );
  }
  if (value === false) {
    return (
      <td className={cn("p-3 sm:p-4 text-center", isBalenciaCol && "bg-primary/[0.04]")}>
        <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/[0.07] text-muted-foreground/70">
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </span>
      </td>
    );
  }
  return (
    <td className={cn("p-3 sm:p-4 text-center", isBalenciaCol && "bg-primary/[0.04]")}>
      <span className="inline-flex items-center justify-center gap-1.5">
        <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/10 text-amber-400/80">
          <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </span>
        <span className="text-xs text-muted-foreground/90 hidden lg:inline">{value}</span>
      </span>
    </td>
  );
}

// ─── Category Header Row ─────────────────────────────────────────────
function CategoryRow({ category }: { category: Category }) {
  const Icon = category.icon;
  return (
    <tr className="comparison-row">
      <td colSpan={6} className="pt-6 pb-3 px-4 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center", category.color)}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground/90 uppercase tracking-wider">
            {category.name}
          </span>
        </div>
      </td>
    </tr>
  );
}

// ─── Mobile Accordion Category ───────────────────────────────────────
function MobileCategoryCard({ category, index }: { category: Category; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const Icon = category.icon;
  const totalFeatures = category.rows.length;
  const balenciaCount = category.rows.filter((r) => r.balencia === true).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-sm overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", category.color)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{category.name}</p>
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">{balenciaCount}/{totalFeatures}</span> full support
          </p>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="border-t border-white/10"
        >
          {category.rows.map((row) => (
            <div
              key={row.feature}
              className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.03] last:border-0"
            >
              <span className="text-sm text-foreground/80 flex-1">{row.feature}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {row.balencia === true ? (
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary inline-flex items-center justify-center">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-white/[0.07] text-muted-foreground/70 inline-flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── COMPARISON TABLE SECTION ────────────────────────────────────────
export function ComparisonTableSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // GSAP scroll-driven section entrance
  useGSAP(
    () => {
      if (!sectionRef.current) return;

      gsap.fromTo(
        sectionRef.current,
        { opacity: 0.3, y: 50 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 92%",
            end: "top 50%",
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    []
  );

  // GSAP staggered row reveal for the table
  useGSAP(
    () => {
      if (!tableRef.current) return;

      const rows = tableRef.current.querySelectorAll(".comparison-row");
      if (!rows.length) return;

      gsap.fromTo(
        rows,
        { opacity: 0, x: -20 },
        {
          opacity: 1,
          x: 0,
          stagger: 0.035,
          duration: 0.5,
          ease: "power2.out",
          scrollTrigger: {
            trigger: tableRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
            once: true,
          },
        }
      );
    },
    tableRef,
    []
  );

  return (
    <section
      ref={sectionRef}
      className="relative py-20 md:py-28 lg:py-36 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.1} blur={100} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <GSAPScrollReveal
          direction="up"
          distance={32}
          duration={0.6}
          stagger={0.1}
          staggerSelector=".ct-header-item"
          className="text-center max-w-3xl mx-auto mb-12 md:mb-16"
        >
          <div className="ct-header-item inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm font-medium text-primary mb-5">
            <Trophy className="w-3.5 h-3.5" />
            Feature Comparison
          </div>

          <h2 className="ct-header-item text-3xl sm:text-4xl md:text-5xl font-bold mb-5 tracking-tight">
            Why <span className="gradient-text-animated">Balencia</span> wins
          </h2>

          <p className="ct-header-item text-base sm:text-lg text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed">
            The only platform that covers AI life coaching across fitness, career,
            relationships, and every life domain. See how we compare.
          </p>
        </GSAPScrollReveal>

        {/* Score Summary Cards */}
        <GSAPScrollReveal
          direction="up"
          distance={24}
          duration={0.5}
          delay={0.15}
          stagger={0.06}
          staggerSelector=".score-card"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 max-w-5xl mx-auto mb-12 md:mb-16"
        >
          {competitors.map((comp) => (
            <div
              key={comp.key}
              className={cn(
                "score-card relative rounded-2xl p-4 sm:p-5 text-center transition-all overflow-hidden",
                comp.highlight
                  ? "bg-gradient-to-b from-primary/15 to-primary/5 border-2 border-primary/30 shadow-lg shadow-primary/10"
                  : "bg-white/[0.03] border border-white/10"
              )}
            >
              {comp.highlight && (
                <>
                  <div className="absolute -top-8 -right-8 w-20 h-20 bg-primary/20 rounded-full blur-2xl" />
                  <div className="absolute top-2 right-2">
                    <Crown className="w-4 h-4 text-primary" />
                  </div>
                </>
              )}
              <p className={cn(
                "text-2xl sm:text-3xl font-bold mb-0.5",
                comp.highlight ? "text-primary" : "text-foreground/70"
              )}>
                <AnimatedCounter target={comp.score} />
                <span className="text-sm font-normal text-muted-foreground">/{TOTAL}</span>
              </p>
              <p className={cn(
                "text-xs sm:text-sm font-medium mb-2.5",
                comp.highlight ? "text-foreground" : "text-muted-foreground"
              )}>
                {comp.name}
              </p>
              <ScoreBar score={comp.score} total={TOTAL} highlight={comp.highlight} />
            </div>
          ))}
        </GSAPScrollReveal>

        {/* Desktop Table */}
        <div className="hidden md:block" ref={tableRef}>
          <div className="relative overflow-x-auto overflow-y-visible rounded-2xl border border-white/10 bg-white/[0.015] backdrop-blur-sm shadow-2xl shadow-black/10">
            {/* Balencia column glow */}
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: "calc(200px + (100% - 200px) * 0 / 5)", width: "calc((100% - 200px) / 5)" }}>
              <div className="absolute inset-0 bg-primary/[0.03]" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            </div>

            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-4 sm:p-5 font-semibold text-muted-foreground bg-background/80 backdrop-blur-sm sticky left-0 z-10 min-w-[200px]">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Features
                    </span>
                  </th>
                  <th className="p-4 sm:p-5 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-sm font-bold">
                        <Crown className="w-3.5 h-3.5" />
                        Balencia
                      </span>
                    </div>
                  </th>
                  <th className="p-4 sm:p-5 text-center text-muted-foreground text-sm font-medium min-w-[120px]">
                    Generic Apps
                  </th>
                  <th className="p-4 sm:p-5 text-center text-muted-foreground text-sm font-medium min-w-[120px]">
                    WHOOP
                  </th>
                  <th className="p-4 sm:p-5 text-center text-muted-foreground text-sm font-medium min-w-[120px]">
                    Calorie Apps
                  </th>
                  <th className="p-4 sm:p-5 text-center text-muted-foreground text-sm font-medium min-w-[120px]">
                    Bevel
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <CategoryGroup key={cat.name} category={cat} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {categories.map((cat, i) => (
            <MobileCategoryCard key={cat.name} category={cat} index={i} />
          ))}
        </div>

        {/* Bottom CTA hint */}
        <GSAPScrollReveal direction="up" distance={20} duration={0.5} delay={0.2} className="text-center mt-10 md:mt-14">
          <p className="text-sm text-muted-foreground">
            <span className="text-primary font-semibold">{TOTAL}/{TOTAL} features</span>{" "}
            — Balencia is the only platform with complete coverage.
          </p>
        </GSAPScrollReveal>
      </div>
    </section>
  );
}

// ─── Category Group (desktop table) ──────────────────────────────────
function CategoryGroup({ category }: { category: Category }) {
  return (
    <>
      <CategoryRow category={category} />
      {category.rows.map((row, i) => (
        <tr
          key={row.feature}
          className={cn(
            "comparison-row border-b border-white/[0.04] transition-colors duration-200 hover:bg-white/[0.03] group",
            i === category.rows.length - 1 && "border-b-white/10"
          )}
        >
          <td className="p-3 sm:p-4 pl-4 sm:pl-5 sticky left-0 bg-background/80 backdrop-blur-sm z-[1] min-w-[200px]">
            <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
              {row.feature}
            </span>
          </td>
          <Cell value={row.balencia} isBalenciaCol />
          <Cell value={row.generic} />
          <Cell value={row.whoop} />
          <Cell value={row.calorie} />
          <Cell value={row.bevel} />
        </tr>
      ))}
    </>
  );
}
