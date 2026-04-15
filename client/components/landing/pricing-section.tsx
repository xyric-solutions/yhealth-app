"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Zap, Crown, Users, Shield, ArrowRight, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import type { PlanItem } from "@/components/subscription/PricingSection";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

function getPlanIcon(slug: string) {
  if (slug === "starter") return Zap;
  if (slug === "pro" || slug === "pro-yearly") return Crown;
  return Users;
}

function getPlanIconBg(slug: string) {
  if (slug === "starter") return "bg-[#00BCD4]";
  if (slug === "pro" || slug === "pro-yearly") return "bg-[#7C3AED]";
  return "bg-[#EC4899]";
}

function getPlanCheckColor(slug: string) {
  if (slug === "starter") return "text-[#00BCD4]";
  if (slug === "pro" || slug === "pro-yearly") return "text-primary-foreground";
  return "text-[#EC4899]";
}

function getPlanCheckBg(slug: string) {
  if (slug === "starter") return "bg-[#00BCD4]/20";
  if (slug === "pro" || slug === "pro-yearly") return "bg-primary";
  return "bg-[#EC4899]/20";
}

// ─── Sparkle particles for popular card ──────────────────────────────
function SparkleParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl sm:rounded-3xl">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary"
          style={{
            left: `${15 + i * 14}%`,
            top: `${10 + (i % 3) * 35}%`,
            boxShadow: "0 0 6px hsl(var(--primary)), 0 0 12px hsl(var(--primary) / 0.5)",
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, (i % 2 === 0 ? 8 : -8), 0],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 3 + i * 0.4,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated price number ───────────────────────────────────────────
function AnimatedPrice({ value }: { value: number }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        exit={{ y: -20, opacity: 0, filter: "blur(4px)" }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="inline-block"
      >
        ${value}
      </motion.span>
    </AnimatePresence>
  );
}

// ─── Pricing Card ────────────────────────────────────────────────────
function PricingCard({
  plan,
  index,
  isYearly,
}: {
  plan: PlanItem & { iconBg: string; checkBg: string; checkColor: string; popular: boolean; cta: string };
  index: number;
  isYearly: boolean;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const IconComponent = getPlanIcon(plan.slug);

  const amount = plan.amount_cents / 100;
  const displayPrice = plan.interval === "year" ? Math.round(amount / 12) : amount;
  const yearlyTotal = plan.interval === "year" ? amount : null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={cn(
        "pricing-card-gsap relative flex flex-col h-full",
        plan.popular && "pricing-recommended lg:-mt-4 lg:mb-4"
      )}
    >
      {plan.popular && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="absolute -top-5 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25">
            <Star className="w-3.5 h-3.5 fill-current" />
            Most Popular
          </div>
        </motion.div>
      )}

      {/* Popular card gradient glow aura */}
      {plan.popular && (
        <motion.div
          className="absolute -inset-1 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-primary via-purple-500 to-pink-500 blur-lg"
          animate={{ opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.div
        className={cn(
          "relative flex flex-col h-full rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 transition-all duration-300",
          plan.popular
            ? "bg-card border-2 border-primary shadow-xl shadow-primary/10"
            : "bg-card/80 border border-border hover:border-primary/30 hover:shadow-lg"
        )}
        animate={plan.popular ? { y: [0, -6, 0] } : {}}
        transition={plan.popular ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : {}}
      >
        {plan.popular && (
          <>
            <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <SparkleParticles />
          </>
        )}

        <div className="relative text-center mb-5 sm:mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : {}}
            transition={{ delay: index * 0.1 + 0.2, type: "spring", stiffness: 200 }}
            className={cn("w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl mx-auto mb-3 sm:mb-4 flex items-center justify-center", plan.iconBg)}
          >
            {/* eslint-disable-next-line react-hooks/static-components */}
            <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </motion.div>

          <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2">{plan.name}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">{plan.description || "Choose the right plan for you"}</p>
        </div>

        {/* Price with animation on toggle */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl sm:text-4xl md:text-5xl font-bold">
              <AnimatedPrice value={displayPrice} />
            </span>
            <span className="text-muted-foreground text-sm sm:text-base">/mo</span>
          </div>
          {isYearly && yearlyTotal != null && yearlyTotal > 0 && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Billed <span className="text-primary font-medium">${yearlyTotal}</span>/year
            </p>
          )}
          {plan.amount_cents === 0 && (
            <p className="text-xs sm:text-sm text-primary font-medium mt-1">Free forever</p>
          )}
        </div>

        {/* Feature list with staggered checkmark animation */}
        <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8 flex-grow">
          {(plan.features || []).map((feature, i) => (
            <motion.li
              key={`${feature}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: index * 0.1 + 0.3 + i * 0.06 }}
              className="flex items-start gap-2 sm:gap-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ delay: index * 0.1 + 0.35 + i * 0.06, type: "spring", stiffness: 300 }}
                className={cn("w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5", plan.checkBg)}
              >
                <Check className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3", plan.checkColor)} />
              </motion.div>
              <span className="text-xs sm:text-sm text-muted-foreground">{feature}</span>
            </motion.li>
          ))}
        </ul>

        <Button
          asChild
          size="lg"
          variant={plan.popular ? "default" : "outline"}
          className={cn(
            "w-full h-10 sm:h-12 font-semibold rounded-lg sm:rounded-xl text-sm sm:text-base",
            plan.popular && "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
          )}
        >
          <Link href="/plans" className="flex items-center justify-center gap-2">
            {plan.cta}
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ─── PRICING SECTION ─────────────────────────────────────────────────
export function PricingSection() {
  const sectionContainerRef = useRef<HTMLElement>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // GSAP stagger entrance for pricing cards + glow on recommended
  useGSAP(
    () => {
      if (!sectionContainerRef.current) return;

      // Stagger entrance for all pricing cards
      gsap.from(".pricing-card-gsap", {
        y: 60,
        opacity: 0,
        scale: 0.95,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionContainerRef.current,
          start: "top 75%",
        },
      });

      // Pulsing glow on recommended/popular card
      gsap.fromTo(
        ".pricing-recommended",
        { boxShadow: "0 0 0px rgba(14,165,233,0)" },
        {
          boxShadow: "0 0 30px rgba(14,165,233,0.3)",
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          scrollTrigger: {
            trigger: ".pricing-recommended",
            start: "top 80%",
          },
        }
      );
    },
    sectionContainerRef,
    [loading]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ plans: PlanItem[] }>("/subscription/plans");
        if (!cancelled && res.data?.plans) setPlans(res.data.plans);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const displayPlans = useMemo(() => {
    const interval = isYearly ? "year" : "month";
    const filtered = plans.filter((p) => p.interval === interval);
    return filtered.map((p) => ({
      ...p,
      iconBg: getPlanIconBg(p.slug),
      checkBg: getPlanCheckBg(p.slug),
      checkColor: getPlanCheckColor(p.slug),
      popular: p.slug === "pro" || p.slug === "pro-yearly",
      cta: p.amount_cents === 0 ? "Get Started Free" : "Start 14-Day Trial",
    }));
  }, [plans, isYearly]);

  return (
    <section ref={sectionContainerRef} id="pricing" className="py-20 md:py-28 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-30" />
      <AnimatedGradientMesh intensity={0.2} speed={0.85} blur={110} />
      <div className="absolute top-0 left-1/4 w-48 sm:w-72 md:w-96 h-48 sm:h-72 md:h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-40 sm:w-64 md:w-80 h-40 sm:h-64 md:h-80 bg-[#7C3AED]/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <GSAPScrollReveal
          direction="up"
          distance={24}
          stagger={0.1}
          staggerSelector=".pricing-header-item"
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 md:mb-12"
        >
          <div className="pricing-header-item inline-flex items-center gap-2 glass-card px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span>Simple Pricing</span>
          </div>

          <h2 className="pricing-header-item text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 md:mb-6">
            Invest in Your <span className="gradient-text-animated">Health Journey</span>
          </h2>

          <p className="pricing-header-item text-sm sm:text-base md:text-lg text-muted-foreground px-2 sm:px-4">
            Choose the perfect plan for your wellness goals. All paid plans include a 14-day free trial.
          </p>
        </GSAPScrollReveal>

        {/* Billing Toggle */}
        <GSAPScrollReveal direction="up" distance={20} delay={0.3}>
          <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mb-8 sm:mb-10 md:mb-12">
            <span className={cn("text-xs sm:text-sm font-medium transition-colors", !isYearly ? "text-foreground" : "text-muted-foreground")}>
              Monthly
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} className="data-[state=checked]:bg-primary" />
            <span className={cn("text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2", isYearly ? "text-foreground" : "text-muted-foreground")}>
              Yearly
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs font-medium">
                Save 20%
              </span>
            </span>
          </div>
        </GSAPScrollReveal>

        {/* Cards */}
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : displayPlans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No plans available at the moment.</p>
            <Button asChild variant="outline"><Link href="/plans">View pricing page</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-8xl mx-auto items-stretch">
            {displayPlans.map((plan, index) => (
              <PricingCard key={plan.id} plan={plan} index={index} isYearly={isYearly} />
            ))}
          </div>
        )}

        {/* Trust Badges */}
        <GSAPScrollReveal direction="up" distance={24} delay={0.4}>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 md:gap-8 mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-8 border-t border-border/50">
            {[
              { icon: Shield, text: "30-day money-back guarantee" },
              { icon: Zap, text: "Cancel anytime" },
              { icon: Check, text: "No hidden fees" },
            ].map((badge) => (
              <div key={badge.text} className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <badge.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                <span>{badge.text}</span>
              </div>
            ))}
          </div>
        </GSAPScrollReveal>
      </div>
    </section>
  );
}
