"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Activity,
  Link2,
  ArrowRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

// ─── SVG Icons ───────────────────────────────────────────────────────

function AppleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function GoogleFitIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" opacity="0.3" />
      <path d="M12.75 3.94c.55.83.88 1.79.88 2.81 0 1.76-.9 3.31-2.25 4.22l-2.06-2.06L12.75 3.94zM8.36 8.98L5.94 6.56C4.73 8.11 4 10 4 12c0 2 .73 3.89 1.94 5.44l2.42-2.42C7.53 14.01 7 13.06 7 12s.53-2.01 1.36-3.02zM12 20c2 0 3.89-.73 5.44-1.94l-2.42-2.42c-1.01.83-2.06 1.36-3.02 1.36s-2.01-.53-3.02-1.36l-2.42 2.42C8.11 19.27 10 20 12 20zm6.56-5.94l-2.42-2.42c.83-1.01 1.36-2.06 1.36-3.02h-.01c-.01-.33-.05-.65-.13-.96l2.63-2.63A9.97 9.97 0 0 1 22 12c0 2-1.27 4.52-3.44 5.06z" />
    </svg>
  );
}

function FitbitIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="20" r="2" />
      <circle cx="8" cy="6" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
      <circle cx="8" cy="18" r="1.5" />
      <circle cx="16" cy="6" r="1.5" />
      <circle cx="16" cy="12" r="1.5" />
      <circle cx="16" cy="18" r="1.5" />
    </svg>
  );
}

function GarminIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z" />
      <path d="M14 11h-3v3h1v-2h2z" />
    </svg>
  );
}

function SamsungIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5 7h14c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2zm0 2v6h14V9H5zm2 1h2v4H7v-4zm3 0h2v4h-2v-4zm3 0h2v4h-2v-4z" />
    </svg>
  );
}

function StravaIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

function MyFitnessPalIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z" />
    </svg>
  );
}

function PelotonIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z" />
    </svg>
  );
}

function WhoopIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.14-7-7 3.14-7 7-7z" />
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────

const integrations = [
  {
    name: "Apple Health",
    Icon: AppleIcon,
    accent: "#A2AAAD",
    gradient: "from-gray-300 to-gray-500",
    desc: "Sync workouts, steps & vitals",
    dataPoints: "142K",
    dataType: "Health Kit",
  },
  {
    name: "Google Fit",
    Icon: GoogleFitIcon,
    accent: "#4285F4",
    gradient: "from-blue-400 to-green-400",
    desc: "Activity & heart rate data",
    dataPoints: "89K",
    dataType: "Fitness API",
  },
  {
    name: "Fitbit",
    Icon: FitbitIcon,
    accent: "#00B0B9",
    gradient: "from-teal-400 to-teal-600",
    desc: "Sleep, activity & SPO2",
    dataPoints: "216K",
    dataType: "Web API",
  },
  {
    name: "Garmin",
    Icon: GarminIcon,
    accent: "#F7941D",
    gradient: "from-orange-400 to-orange-600",
    desc: "GPS & performance metrics",
    dataPoints: "178K",
    dataType: "Connect IQ",
  },
  {
    name: "Samsung Health",
    Icon: SamsungIcon,
    accent: "#1428A0",
    gradient: "from-blue-500 to-blue-700",
    desc: "Full health ecosystem sync",
    dataPoints: "95K",
    dataType: "Health SDK",
  },
  {
    name: "Strava",
    Icon: StravaIcon,
    accent: "#FC4C02",
    gradient: "from-orange-500 to-red-600",
    desc: "Running & cycling data",
    dataPoints: "312K",
    dataType: "OAuth API",
  },
  {
    name: "Whoop",
    Icon: WhoopIcon,
    accent: "#44D62C",
    gradient: "from-emerald-400 to-green-600",
    desc: "Strain, recovery & sleep",
    dataPoints: "264K",
    dataType: "Developer API",
  },
  {
    name: "MyFitnessPal",
    Icon: MyFitnessPalIcon,
    accent: "#0062FF",
    gradient: "from-blue-400 to-blue-600",
    desc: "Nutrition & calorie tracking",
    dataPoints: "198K",
    dataType: "Diary API",
  },
  {
    name: "Peloton",
    Icon: PelotonIcon,
    accent: "#D0021B",
    gradient: "from-red-500 to-red-700",
    desc: "Workout classes & metrics",
    dataPoints: "87K",
    dataType: "Telemetry",
  },
];

const hubStats = [
  { display: "9", label: "Connected platforms" },
  { display: "2.4M+", label: "Data points synced" },
  { display: "Real-time", label: "Sync frequency" },
];

// (AnimatedCounter removed — stats use direct display values)

// ─── Orbiting Dot ────────────────────────────────────────────────────
function OrbitingDot({
  radius,
  duration,
  delay,
  color,
  size = 4,
}: {
  radius: number;
  duration: number;
  delay: number;
  color: string;
  size?: number;
}) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{ width: 0, height: 0 }}
      animate={{ rotate: 360 }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear",
        delay,
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          boxShadow: `0 0 8px ${color}88`,
          transform: `translate(-50%, -50%) translateX(${radius}px)`,
        }}
      />
    </motion.div>
  );
}

// ─── Central Hub ─────────────────────────────────────────────────────
function CentralHub({ activeIndex }: { activeIndex: number }) {
  const integration = integrations[activeIndex];

  return (
    <div className="relative flex flex-col items-center justify-center h-[280px] sm:h-[320px]">
      {/* Dashed orbit rings */}
      {[100, 130, 160].map((r, i) => (
        <motion.div
          key={r}
          className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
          style={{
            width: r * 2,
            height: r * 2,
            marginLeft: -r,
            marginTop: -r,
            borderColor: `hsl(var(--primary) / ${0.12 - i * 0.03})`,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{
            duration: 50 + i * 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      {/* Orbiting dots — one per integration, spread across rings */}
      {integrations.map((int, i) => {
        const ringRadii = [100, 130, 160];
        const radius = ringRadii[i % 3];
        return (
          <OrbitingDot
            key={`dot-${i}`}
            radius={radius}
            duration={15 + i * 3}
            delay={i * 1.2}
            color={int.accent}
            size={4 + (i % 2)}
          />
        );
      })}

      {/* Core hub */}
      <div className="relative z-10">
        <motion.div
          className="absolute -inset-6 rounded-full blur-[30px] bg-primary/20"
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center border-2 border-white/20 shadow-2xl shadow-primary/30"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-white" />

          {/* Pulse rings */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border border-white/15"
            animate={{ scale: [1, 2.4], opacity: [0.3, 0] }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.5,
            }}
          />
        </motion.div>
      </div>

      {/* Active integration label */}
      <div className="relative z-10 mt-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Balencia Hub
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground/70" />
            <span
              className="text-xs font-semibold"
              style={{ color: integration.accent }}
            >
              {integration.name}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Integration Card ────────────────────────────────────────────────
function IntegrationCard({
  integration,
  index,
  isActive,
  onClick,
}: {
  integration: (typeof integrations)[0];
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = integration.Icon;

  return (
    <motion.div
      className={cn(
        "integration-card group relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-500",
        isActive
          ? "border-white/20 bg-white/[0.07]"
          : "border-white/[0.12] bg-white/[0.07] hover:border-white/15"
      )}
      onClick={onClick}
      whileHover={{
        y: -4,
        boxShadow: `0 0 40px -10px ${integration.accent}33, 0 0 0 1px rgba(255,255,255,0.08)`,
      }}
      transition={{ duration: 0.25 }}
    >
      {/* Active gradient top border */}
      <motion.div
        className={cn(
          "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r",
          integration.gradient
        )}
        animate={{ opacity: isActive ? 1 : 0.3 }}
        transition={{ duration: 0.3 }}
      />

      {/* Corner glow on active */}
      {isActive && (
        <motion.div
          className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-[40px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          style={{ background: `${integration.accent}20` }}
        />
      )}

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          {/* Icon */}
          <div
            className={cn(
              "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md transition-shadow duration-300",
              integration.gradient
            )}
            style={{
              boxShadow: isActive
                ? `0 4px 20px ${integration.accent}33`
                : undefined,
            }}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm text-foreground/90 truncate">
                {integration.name}
              </h4>
              <motion.div
                className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.3,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground/80 mb-2.5 line-clamp-1">
              {integration.desc}
            </p>

            {/* Status row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-[10px] font-medium text-emerald-400">
                <Check className="w-2.5 h-2.5" strokeWidth={3} />
                Live
              </span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04]"
                style={{ color: integration.accent }}
              >
                {integration.dataType}
              </span>
              <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                {integration.dataPoints} pts
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── INTEGRATIONS SECTION ────────────────────────────────────────────
export function IntegrationsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-cycle active integration
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % integrations.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // GSAP section entrance
  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0.2, y: 50 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 92%",
            end: "top 45%",
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    []
  );

  // GSAP staggered card reveal
  useGSAP(
    () => {
      if (!gridRef.current) return;
      const cards = gridRef.current.querySelectorAll(".integration-card");
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 40, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.06,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 82%",
            toggleActions: "play none none none",
            once: true,
          },
        }
      );
    },
    gridRef,
    []
  );

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.15} blur={120} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />
        <div className="absolute top-1/4 left-[10%] w-80 h-80 bg-primary/[0.05] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-[15%] w-96 h-96 bg-purple-500/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <GSAPScrollReveal
          direction="up"
          distance={30}
          duration={0.7}
          className="text-center max-w-4xl mx-auto mb-10 md:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm font-medium text-primary mb-6">
            <Link2 className="w-3.5 h-3.5" />
            Integrations
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 tracking-tight leading-[1.1]">
            Your life data,{" "}
            <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
              unified
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Seamlessly sync health data from all your devices and apps. One hub,
            every metric, zero manual entry.
          </p>
        </GSAPScrollReveal>

        {/* Stats row */}
        <GSAPScrollReveal
          direction="up"
          distance={20}
          stagger={0.08}
          staggerSelector=".hub-stat"
          className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-10 md:mb-14"
        >
          {hubStats.map((stat) => (
            <div
              key={stat.label}
              className="hub-stat flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.12] bg-white/[0.07]"
            >
              <span className="text-base sm:text-lg font-black text-primary tabular-nums">
                {stat.display}
              </span>
              <span className="text-xs text-muted-foreground/80 font-medium">
                {stat.label}
              </span>
            </div>
          ))}
        </GSAPScrollReveal>

        {/* Central hub */}
        <GSAPScrollReveal
          direction="scale"
          duration={0.6}
          className="mb-10 md:mb-14"
        >
          <CentralHub activeIndex={activeIndex} />
        </GSAPScrollReveal>

        {/* Integration grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto"
        >
          {integrations.map((integration, i) => (
            <IntegrationCard
              key={integration.name}
              integration={integration}
              index={i}
              isActive={activeIndex === i}
              onClick={() => setActiveIndex(i)}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <GSAPScrollReveal
          direction="up"
          distance={20}
          duration={0.5}
          delay={0.2}
          className="text-center mt-12 md:mt-16"
        >
          <motion.div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary/10 border border-primary/20"
            whileHover={{ scale: 1.03, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground/80">
              And{" "}
              <span className="text-primary font-bold">50+ more</span>{" "}
              integrations coming soon
            </span>
            <Sparkles className="w-4 h-4 text-primary/60" />
          </motion.div>
        </GSAPScrollReveal>
      </div>
    </section>
  );
}
