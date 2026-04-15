"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { motion, useMotionValue, useSpring, useInView } from "framer-motion";
import { ArrowRight, Sparkles, Heart, Footprints, Trophy, Check } from "lucide-react";
import { CTASplineScene } from "./spline/CTASplineScene";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/common/motion";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, MagneticButton } from "./shared";

// ─── Floating metric card ────────────────────────────────────────────
function FloatingMetricCard({
  icon: Icon,
  label,
  value,
  color,
  className,
  animDelay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  className: string;
  animDelay?: number;
}) {
  return (
    <motion.div
      animate={{ y: [0, -12, 0], rotate: [0, 3, 0] }}
      transition={{ duration: 5 + animDelay, repeat: Infinity, ease: "easeInOut", delay: animDelay }}
      className={`absolute hidden lg:block ${className}`}
    >
      <div className="glass-card rounded-xl p-3 border border-white/10 shadow-2xl backdrop-blur-md flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground/80">{label}</p>
          <p className="text-sm font-bold text-white">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Urgency counter ─────────────────────────────────────────────────
function UrgencyCounter() {
  const [count, setCount] = useState(127);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setCount((prev) => prev + Math.floor(Math.random() * 3));
    }, 8000);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.5 }}
      className="flex items-center justify-center gap-2 mt-6"
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-emerald-400"
        animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-sm text-muted-foreground">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-primary font-semibold"
        >
          {count}
        </motion.span>{" "}
        people started their journey today
      </span>
    </motion.div>
  );
}

// ─── CTA SECTION ─────────────────────────────────────────────────────
export function CTASection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 30 });
  const [glowVisible, setGlowVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // GSAP word-by-word title reveal
  useGSAP(
    () => {
      if (!containerRef.current) return;
      gsap.from(".cta-word", {
        y: "100%",
        opacity: 0,
        duration: 0.8,
        stagger: 0.06,
        ease: "expo.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
        },
      });
    },
    sectionRef,
    []
  );

  // Cinematic dramatic zoom-in entrance
  useGSAP(
    () => {
      if (!containerRef.current || !sectionRef.current) return;
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, scale: 0.75, y: 80, rotateX: 8, filter: "blur(8px)" },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          rotateX: 0,
          filter: "blur(0px)",
          transformPerspective: 1200,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            end: "top 20%",
            scrub: 1.5,
          },
        }
      );
    },
    sectionRef,
    []
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
    setGlowVisible(true);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    setGlowVisible(false);
  }, []);

  const fireConfetti = useCallback(() => {
    const count = 80;
    const defaults = { origin: { y: 0.7 }, zIndex: 1000 };
    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
    }
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, []);

  return (
    <section ref={sectionRef} className="py-20 md:py-28 lg:py-32 relative overflow-hidden">
      {/* Spline 3D background layer */}
      <div className="absolute inset-0 -z-20 pointer-events-none">
        <CTASplineScene />
      </div>

      {/* Background */}
      <AnimatedGradientMesh intensity={0.25} speed={1} blur={120} />
      <div className="absolute inset-0 animated-gradient opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background" />

      {/* Cosmic Void Effect — black hole glow at bottom */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full pointer-events-none" aria-hidden="true">
        {/* Outer glow ring */}
        <motion.div
          className="absolute bottom-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-[50%]"
          style={{
            background: "radial-gradient(ellipse at 50% 100%, hsl(280 80% 50% / 0.35) 0%, hsl(260 90% 40% / 0.15) 30%, transparent 70%)",
            filter: "blur(60px)",
          }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Inner bright core */}
        <motion.div
          className="absolute bottom-[-120px] left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-[50%]"
          style={{
            background: "radial-gradient(ellipse at 50% 100%, hsl(270 90% 65% / 0.5) 0%, hsl(280 80% 50% / 0.2) 40%, transparent 70%)",
            filter: "blur(40px)",
          }}
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Horizontal light streak */}
        <motion.div
          className="absolute bottom-[30px] left-1/2 -translate-x-1/2 w-[600px] h-[2px]"
          style={{
            background: "linear-gradient(90deg, transparent 0%, hsl(280 80% 70% / 0.6) 30%, hsl(260 90% 80% / 0.8) 50%, hsl(280 80% 70% / 0.6) 70%, transparent 100%)",
            filter: "blur(1px)",
          }}
          animate={{
            opacity: [0.4, 0.8, 0.4],
            scaleX: [0.8, 1, 0.8],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div
          ref={containerRef}
          className="relative rounded-3xl p-8 sm:p-10 md:p-16 border border-white/10 shadow-2xl overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Aurora background */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute -inset-[50%] opacity-30"
              animate={{
                background: [
                  "radial-gradient(ellipse at 30% 50%, hsl(var(--primary) / 0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, hsl(280 80% 60% / 0.3) 0%, transparent 50%)",
                  "radial-gradient(ellipse at 50% 30%, hsl(330 80% 60% / 0.3) 0%, transparent 50%), radial-gradient(ellipse at 40% 70%, hsl(var(--primary) / 0.4) 0%, transparent 50%)",
                  "radial-gradient(ellipse at 70% 60%, hsl(280 80% 60% / 0.4) 0%, transparent 50%), radial-gradient(ellipse at 30% 40%, hsl(190 90% 50% / 0.3) 0%, transparent 50%)",
                  "radial-gradient(ellipse at 30% 50%, hsl(var(--primary) / 0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, hsl(280 80% 60% / 0.3) 0%, transparent 50%)",
                ],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-background/60" />
          </div>

          {/* Cursor-following glow */}
          <motion.div
            className="absolute w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
              filter: "blur(40px)",
              x: "-50%",
              y: "-50%",
              opacity: glowVisible ? 0.8 : 0,
              left: `calc(${springX.get() * 100}%)`,
              top: `calc(${springY.get() * 100}%)`,
            }}
            transition={{ opacity: { duration: 0.3 } }}
          />

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Floating metric cards */}
          <FloatingMetricCard
            icon={Heart}
            label="Resting Heart Rate"
            value="58 bpm"
            color="from-red-500 to-pink-500"
            className="top-6 right-12"
            animDelay={0}
          />
          <FloatingMetricCard
            icon={Footprints}
            label="Goals Achieved"
            value="23 this month"
            color="from-cyan-500 to-blue-500"
            className="bottom-8 left-12"
            animDelay={1.5}
          />
          <FloatingMetricCard
            icon={Trophy}
            label="Life Score"
            value="94/100"
            color="from-amber-500 to-orange-500"
            className="top-1/2 -translate-y-1/2 right-8"
            animDelay={0.8}
          />

          {/* Content */}
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <FadeUp>
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium mb-6 border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Limited Time -- Start Free for 14 Days</span>
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 overflow-hidden">
                {["Your", "Best", "Life"].map((word) => (
                  <span key={word} className="cta-word inline-block mr-[0.3em]">
                    {word}
                  </span>
                ))}{" "}
                <span className="gradient-text-animated">
                  {["Starts", "Today"].map((word) => (
                    <span key={word} className="cta-word inline-block mr-[0.3em]">
                      {word}
                    </span>
                  ))}
                </span>
              </h2>
            </FadeUp>

            <FadeUp delay={0.2}>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
                Join 50,000+ members who have transformed their fitness, career,
                relationships, and more with an AI life coach that adapts to you.
                Average users see measurable results within the first 30 days.
              </p>
            </FadeUp>

            <FadeUp delay={0.3}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <MagneticButton>
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 glow-cyan transition-all duration-300"
                    asChild
                  >
                    <Link href="/auth/signup" onClick={fireConfetti}>
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </MagneticButton>
                <MagneticButton>
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg glass-card border-white/20 backdrop-blur-xl hover:border-primary/50 transition-all duration-300" asChild>
                    <Link href="/plans">View Pricing</Link>
                  </Button>
                </MagneticButton>
              </div>
            </FadeUp>

            {/* Trust Indicators */}
            <FadeUp delay={0.4}>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-8 sm:mt-10 text-sm text-muted-foreground">
                {["No credit card required", "Cancel anytime, no questions asked", "Full premium access for 14 days"].map((text) => (
                  <div key={text} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </FadeUp>

            {/* Urgency counter */}
            <UrgencyCounter />
          </div>
        </div>
      </div>
    </section>
  );
}
