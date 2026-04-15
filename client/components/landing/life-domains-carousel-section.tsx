"use client";

import { useRef } from "react";
import {
  Dumbbell,
  Utensils,
  Brain,
  Briefcase,
  DollarSign,
  Heart,
  BookOpen,
  Sparkles,
  Moon,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal, GSAPMarquee } from "./shared";

// ─── Domain Data ─────────────────────────────────────────────────────

const domains = [
  {
    icon: Dumbbell,
    name: "Fitness",
    gradient: "from-cyan-400 to-teal-500",
    suggestion: '"Swap today\'s HIIT for a recovery walk — your HRV is low."',
  },
  {
    icon: Utensils,
    name: "Nutrition",
    gradient: "from-emerald-400 to-green-500",
    suggestion: '"You\'re 20g short on protein. Here\'s a quick smoothie recipe."',
  },
  {
    icon: Brain,
    name: "Mindfulness",
    gradient: "from-purple-400 to-violet-500",
    suggestion: '"You seem stressed. Try a 5-min breathing exercise before your meeting."',
  },
  {
    icon: Briefcase,
    name: "Career",
    gradient: "from-sky-400 to-blue-500",
    suggestion: '"Big presentation tomorrow? Let\'s outline your talking points tonight."',
  },
  {
    icon: DollarSign,
    name: "Finances",
    gradient: "from-lime-400 to-emerald-500",
    suggestion: '"3 unused subscriptions spotted. Cancel to save $47/month."',
  },
  {
    icon: Heart,
    name: "Relationships",
    gradient: "from-pink-400 to-rose-500",
    suggestion: '"You haven\'t called Mom in 2 weeks. Schedule a quick check-in?"',
  },
  {
    icon: Moon,
    name: "Spirituality",
    gradient: "from-indigo-400 to-purple-500",
    suggestion: '"Fajr in 20 min. Would you like a gentle wake-up reminder?"',
  },
  {
    icon: BookOpen,
    name: "Education",
    gradient: "from-amber-400 to-orange-500",
    suggestion: '"15 min before your next meeting. Perfect for one lesson on React hooks."',
  },
  {
    icon: Palette,
    name: "Creativity",
    gradient: "from-fuchsia-400 to-pink-500",
    suggestion: '"Your journaling streak is 12 days! Try a creative writing prompt today."',
  },
  {
    icon: Sparkles,
    name: "Habits",
    gradient: "from-teal-400 to-cyan-500",
    suggestion: '"Morning routine 90% complete. Just hydration left — drink 500ml now."',
  },
];

// ─── Domain Card ─────────────────────────────────────────────────────

function DomainCard({ domain }: { domain: (typeof domains)[number] }) {
  const Icon = domain.icon;
  return (
    <div className="shrink-0 w-[280px] sm:w-[320px] rounded-2xl border border-white/[0.08] bg-white/[0.015] backdrop-blur-sm overflow-hidden hover:border-white/20 transition-all duration-300 group">
      {/* Top gradient bar */}
      <div
        className={cn(
          "h-[2px] bg-gradient-to-r opacity-50 group-hover:opacity-100 transition-opacity",
          domain.gradient
        )}
      />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm",
              domain.gradient
            )}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-foreground/90">
            {domain.name}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground/70 italic leading-relaxed">
          {domain.suggestion}
        </p>
      </div>
    </div>
  );
}

// ─── LIFE DOMAINS CAROUSEL SECTION ───────────────────────────────────
export function LifeDomainsCarouselSection() {
  const sectionRef = useRef<HTMLElement>(null);

  // GSAP section entrance
  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0, y: 40, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 90%",
            end: "top 40%",
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    []
  );

  return (
    <section
      ref={sectionRef}
      className="relative py-16 md:py-24 overflow-hidden"
    >
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.1} blur={100} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </div>

      <div className="container mx-auto px-4 text-center mb-10 md:mb-12">
        <GSAPScrollReveal direction="up" distance={24} duration={0.6}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            One AI Coach.{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
              Every dimension
            </span>{" "}
            of your life.
          </h2>
        </GSAPScrollReveal>
        <GSAPScrollReveal
          direction="up"
          distance={16}
          duration={0.6}
          delay={0.1}
        >
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Proactive AI suggestions across fitness, career, finances,
            relationships, and more — all from a single coach that understands
            the full picture.
          </p>
        </GSAPScrollReveal>
      </div>

      <div className="relative w-full">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <GSAPMarquee speed={50} pauseOnHover scrollSensitive>
          {domains.map((domain) => (
            <DomainCard key={domain.name} domain={domain} />
          ))}
        </GSAPMarquee>
      </div>
    </section>
  );
}
