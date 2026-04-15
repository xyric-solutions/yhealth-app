"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import { Star, CheckCircle, Quote, Sparkles, Crown, Dumbbell, Apple, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

interface Testimonial {
  id: string | number;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  content: string;
  verified: boolean;
  pillar?: "fitness" | "nutrition" | "wellbeing";
  is_featured?: boolean;
}

// Fallback hardcoded testimonials (used when API is unavailable)
const fallbackTestimonials: Testimonial[] = [
  { id: 1, name: "Sarah Johnson", role: "Fitness Enthusiast", avatar: "/avatars/sarah.jpg", rating: 5, verified: true, pillar: "fitness", is_featured: true, content: "Balencia completely transformed my approach to wellness. The AI insights helped me understand my body better than any other app. I've lost 20 pounds and feel more energetic than ever!" },
  { id: 2, name: "Michael Chen", role: "Software Engineer", avatar: "/avatars/michael.jpg", rating: 5, verified: true, pillar: "wellbeing", content: "As someone who spends long hours at the desk, Balencia's reminders and personalized exercise recommendations have been a game-changer. My back pain is gone and I sleep so much better now." },
  { id: 3, name: "Emily Rodriguez", role: "Working Mom", avatar: "/avatars/emily.jpg", rating: 5, verified: true, pillar: "nutrition", content: "Balancing work and family left no time for my health. Balencia made it easy with quick workouts and meal planning. The whole family is eating healthier now!" },
  { id: 4, name: "David Thompson", role: "Marathon Runner", avatar: "/avatars/david.jpg", rating: 5, verified: true, pillar: "fitness", is_featured: true, content: "The training insights and recovery tracking helped me shave 15 minutes off my marathon time. The integration with my fitness devices is seamless." },
  { id: 5, name: "Lisa Park", role: "Yoga Instructor", avatar: "/avatars/lisa.jpg", rating: 5, verified: true, pillar: "wellbeing", content: "I recommend Balencia to all my students. The mindfulness features and stress tracking complement yoga practice beautifully. It's holistic wellness at its best." },
  { id: 6, name: "James Wilson", role: "Personal Trainer", avatar: "/avatars/james.jpg", rating: 5, verified: true, pillar: "fitness", content: "As a fitness professional, I've tried countless apps. Balencia stands out with its comprehensive approach. I use it with all my clients now." },
  { id: 7, name: "Amanda Foster", role: "Nutritionist", avatar: "/avatars/amanda.jpg", rating: 4, verified: true, pillar: "nutrition", content: "The meal tracking and nutritional insights are spot-on. My clients love how easy it is to log their meals and see their progress over time." },
  { id: 8, name: "Robert Kim", role: "Business Executive", avatar: "/avatars/robert.jpg", rating: 5, verified: true, pillar: "wellbeing", content: "With my busy schedule, I needed something that works around my life. Balencia's smart scheduling and quick check-ins fit perfectly into my routine." },
  { id: 9, name: "Jennifer Adams", role: "Healthcare Worker", avatar: "/avatars/jennifer.jpg", rating: 5, verified: true, pillar: "nutrition", content: "Working night shifts made maintaining health difficult. The personalized recommendations adapted to my schedule beautifully. Highly recommended!" },
  { id: 10, name: "Chris Martinez", role: "College Student", avatar: "/avatars/chris.jpg", rating: 5, verified: true, pillar: "fitness", content: "Affordable and effective! As a student on a budget, Balencia gives me premium features without breaking the bank. My energy levels have never been better." },
  { id: 11, name: "Sophia Lee", role: "Wellness Coach", avatar: "/avatars/sophia.jpg", rating: 5, verified: true, pillar: "wellbeing", is_featured: true, content: "The holistic approach to health tracking is exactly what I recommend to my clients. Sleep, nutrition, exercise, and mental wellness all in one place." },
  { id: 12, name: "Daniel Brown", role: "Retired Teacher", avatar: "/avatars/daniel.jpg", rating: 4, verified: true, pillar: "nutrition", content: "At 65, I was skeptical about health apps. Balencia proved me wrong with its easy interface and gentle reminders. My doctor is impressed with my progress!" },
];

const pillarConfig = {
  fitness: { gradient: "from-cyan-400 to-cyan-600", bg: "bg-cyan-500/10", text: "text-cyan-400", icon: Dumbbell, label: "Fitness" },
  nutrition: { gradient: "from-purple-400 to-purple-600", bg: "bg-purple-500/10", text: "text-purple-400", icon: Apple, label: "Nutrition" },
  wellbeing: { gradient: "from-pink-400 to-pink-600", bg: "bg-pink-500/10", text: "text-pink-400", icon: Heart, label: "Wellbeing" },
};

// ─── Testimonial Card ────────────────────────────────────────────────
function TestimonialCard({ testimonial, featured = false }: { testimonial: Testimonial; featured?: boolean }) {
  const isFeatured = featured || testimonial.is_featured;

  return (
    <div className={`relative rounded-2xl p-5 mb-4 break-inside-avoid group transition-all duration-500 ${
      isFeatured
        ? "bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-amber-500/20 shadow-lg shadow-amber-500/5 hover:shadow-amber-500/10 hover:border-amber-500/30"
        : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15] hover:shadow-lg hover:shadow-primary/5"
    }`}>
      {/* Featured glow effect */}
      {isFeatured && (
        <motion.div
          className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/20 blur-sm -z-10"
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Featured crown badge */}
      {isFeatured && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Crown className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}

      {/* Quote watermark */}
      <div className="absolute top-4 right-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500">
        <Quote className="w-10 h-10 text-primary" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <Avatar className={`w-11 h-11 ring-2 ring-offset-2 ring-offset-background transition-all duration-300 ${
            isFeatured ? "ring-amber-500/40" : "ring-primary/20 group-hover:ring-primary/40"
          }`}>
            <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
            <AvatarFallback className="text-sm bg-gradient-to-br from-primary/30 to-purple-500/30 text-foreground font-semibold">
              {testimonial.name.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          {testimonial.verified && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 500 }}
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center"
            >
              <CheckCircle className="w-2.5 h-2.5 text-white" />
            </motion.div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{testimonial.name}</div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 transition-colors ${
                  i < testimonial.rating
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted-foreground/20"
                }`}
              />
            ))}
            <span className="text-xs text-muted-foreground/60 ml-1">{testimonial.rating}.0</span>
          </div>
        </div>
      </div>

      {/* Pillar Badge + Verified */}
      {testimonial.pillar && (
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gradient-to-r ${pillarConfig[testimonial.pillar].gradient} text-white font-medium shadow-sm`}>
            {(() => {
              const Icon = pillarConfig[testimonial.pillar!].icon;
              return <Icon className="w-3 h-3" />;
            })()}
            {pillarConfig[testimonial.pillar].label}
          </span>
          {testimonial.verified && (
            <span className="inline-flex items-center gap-1 text-xs text-green-400/80 bg-green-500/10 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <p className="text-sm text-muted-foreground/90 leading-relaxed relative z-10">
        &quot;{testimonial.content}&quot;
      </p>

      {/* Role footer */}
      <div className="mt-3 pt-3 border-t border-white/[0.06]">
        <span className="text-xs text-muted-foreground/70 font-medium">{testimonial.role}</span>
      </div>
    </div>
  );
}

function TestimonialSkeleton() {
  return (
    <div className="bg-white/[0.04] rounded-2xl p-5 border border-white/[0.08] mb-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-muted/30" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-muted/20 rounded" />
          <div className="h-3 w-20 bg-muted/15 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted/15 rounded" />
        <div className="h-3 w-full bg-muted/10 rounded" />
        <div className="h-3 w-3/4 bg-muted/10 rounded" />
      </div>
    </div>
  );
}

// ─── Scrolling column with hover pause (GSAP) ───────────────────────
function ScrollingColumn({
  items,
  direction,
  duration,
  onHoverStart,
  onHoverEnd,
}: {
  items: Testimonial[];
  direction: "up" | "down";
  duration: number;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // Triple the items for seamless loop
  const tripled = useMemo(() => [...items, ...items, ...items], [items]);
  const singleHeight = items.length * 220; // approximate card height

  useGSAP(
    () => {
      if (!trackRef.current) return;

      const startY = direction === "up" ? 0 : -singleHeight;
      const endY = direction === "up" ? -singleHeight : 0;

      // Set initial position
      gsap.set(trackRef.current, { y: startY });

      // Continuous infinite scroll tween
      tweenRef.current = gsap.to(trackRef.current, {
        y: endY,
        duration,
        ease: "none",
        repeat: -1,
      });
    },
    columnRef,
    [direction, duration, singleHeight]
  );

  const handleMouseEnter = useCallback(() => {
    if (tweenRef.current) {
      gsap.to(tweenRef.current, { timeScale: 0, duration: 0.5 });
    }
    onHoverStart();
  }, [onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    if (tweenRef.current) {
      gsap.to(tweenRef.current, { timeScale: 1, duration: 0.5 });
    }
    onHoverEnd();
  }, [onHoverEnd]);

  return (
    <div
      ref={columnRef}
      className="flex-1 overflow-hidden relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={trackRef}
        className="flex flex-col will-change-transform"
      >
        {tripled.map((testimonial, index) => (
          <TestimonialCard
            key={`${index}-${testimonial.id}`}
            testimonial={testimonial}
            featured={false}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Animated Counter ────────────────────────────────────────────────
function AnimatedCounter({ value, suffix = "", isInView }: { value: string; suffix?: string; isInView: boolean }) {
  const numericPart = value.replace(/[^0-9.]/g, "");
  const prefix = value.replace(/[0-9.].*/g, "");
  const textSuffix = value.replace(/.*[0-9.]/, "");
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    if (!isInView) return;

    const target = parseFloat(numericPart);
    const isDecimal = numericPart.includes(".");
    const steps = 30;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      const progress = Math.min(current / steps, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const val = target * eased;
      setDisplayValue(isDecimal ? val.toFixed(1) : Math.round(val).toString());

      if (current >= steps) clearInterval(interval);
    }, 40);

    return () => clearInterval(interval);
  }, [isInView, numericPart]);

  return <>{prefix}{displayValue}{textSuffix}{suffix}</>;
}

// ─── TESTIMONIALS SECTION ────────────────────────────────────────────
export function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(fallbackTestimonials);
  const [loading, setLoading] = useState(true);
  const [colCount, setColCount] = useState(4);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // Fetch testimonials from API with fallback
  useEffect(() => {
    let cancelled = false;

    async function fetchTestimonials() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
        const res = await fetch(`${baseUrl}/testimonials`, {
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();
        const items = json.data || json;

        if (!cancelled && Array.isArray(items) && items.length > 0) {
          setTestimonials(
            items.map((item: Record<string, unknown>) => ({
              id: item.id as string,
              name: item.name as string,
              role: item.role as string,
              avatar: (item.avatar_url as string) || `/avatars/${(item.name as string).split(" ")[0].toLowerCase()}.jpg`,
              rating: item.rating as number,
              content: item.content as string,
              verified: item.verified as boolean,
              pillar: item.pillar as "fitness" | "nutrition" | "wellbeing" | undefined,
              is_featured: item.is_featured as boolean,
            }))
          );
        }
      } catch {
        // Silently fall back to hardcoded testimonials
      } finally {
        if (!cancelled) {
          // Small delay for skeleton animation visibility
          setTimeout(() => setLoading(false), 300);
        }
      }
    }

    fetchTestimonials();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const updateColCount = () => {
      if (window.innerWidth < 640) setColCount(1);
      else if (window.innerWidth < 768) setColCount(2);
      else if (window.innerWidth < 1024) setColCount(3);
      else if (window.innerWidth < 1280) setColCount(4);
      else setColCount(5);
    };
    updateColCount();
    window.addEventListener("resize", updateColCount);
    return () => window.removeEventListener("resize", updateColCount);
  }, []);

  const columns = useMemo(() => {
    const cols: Testimonial[][] = Array.from({ length: colCount }, () => []);
    testimonials.forEach((testimonial, index) => {
      cols[index % colCount].push(testimonial);
    });
    return cols;
  }, [colCount, testimonials]);

  const handleHoverStart = useCallback(() => {}, []);
  const handleHoverEnd = useCallback(() => {}, []);

  // Compute dynamic stats
  const avgRating = useMemo(() => {
    if (testimonials.length === 0) return "0.0";
    const sum = testimonials.reduce((a, t) => a + t.rating, 0);
    return (sum / testimonials.length).toFixed(1);
  }, [testimonials]);

  const fiveStarCount = useMemo(() => {
    return testimonials.filter(t => t.rating === 5).length;
  }, [testimonials]);

  return (
    <section id="testimonials" className="py-20 md:py-28 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <AnimatedGradientMesh intensity={0.18} speed={0.9} blur={100} />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      {/* Extra ambient orbs */}
      <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl" />

      <div ref={sectionRef} className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <GSAPScrollReveal direction="up" distance={20} duration={0.5}>
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/[0.08]">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-foreground/80">Real Stories, Real Results</span>
            </div>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={20} duration={0.5} delay={0.1}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              Loved by
              <span className="block gradient-text-animated">Thousands Worldwide</span>
            </h2>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={20} duration={0.5} delay={0.2}>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Join thousands of satisfied users who have transformed their health
              journey with Balencia&apos;s AI-powered coaching and personalized wellness plans.
            </p>
          </GSAPScrollReveal>
        </div>

        {/* Testimonials columns */}
        <GSAPScrollReveal direction="fade" duration={0.5} delay={0.3}>
          <div className="relative overflow-hidden h-[650px] sm:h-[700px]">
            {/* Top/bottom fade masks */}
            <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-background via-background/90 to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-background via-background/90 to-transparent z-10 pointer-events-none" />

            <div className="flex gap-4 h-full">
              {loading
                ? Array.from({ length: colCount }).map((_, idx) => (
                    <div key={idx} className="flex-1 flex flex-col">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <TestimonialSkeleton key={i} />
                      ))}
                    </div>
                  ))
                : columns.map((columnTestimonials, columnIndex) => (
                    <ScrollingColumn
                      key={columnIndex}
                      items={columnTestimonials}
                      direction={columnIndex % 2 === 0 ? "up" : "down"}
                      duration={25 + columnIndex * 3}
                      onHoverStart={handleHoverStart}
                      onHoverEnd={handleHoverEnd}
                    />
                  ))}
            </div>
          </div>
        </GSAPScrollReveal>

        {/* Bottom Stats */}
        <GSAPScrollReveal
          direction="up"
          distance={30}
          duration={0.6}
          delay={0.5}
          stagger={0.1}
          staggerSelector=".stat-item"
        >
          <div className="flex flex-wrap justify-center gap-8 sm:gap-12 mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-white/[0.08]">
            {[
              { value: "50K+", label: "Happy Users", icon: "users" },
              { value: `${avgRating}/5`, label: "Average Rating", icon: "star" },
              { value: "98%", label: "Would Recommend", icon: "percent" },
              { value: `${fiveStarCount > 100 ? "10K+" : fiveStarCount.toString()}`, label: "5-Star Reviews", icon: "reviews" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="stat-item text-center group"
              >
                <div className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text group-hover:scale-110 transition-transform duration-300">
                  <AnimatedCounter value={stat.value} isInView={isInView} />
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground/70 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </GSAPScrollReveal>
      </div>
    </section>
  );
}
