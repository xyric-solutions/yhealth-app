"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

export function LeadMagnetSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    // Placeholder: log or send to API later
    setSubmitted(true);
  };

  return (
    <section className="relative py-20 md:py-28 lg:py-32 overflow-hidden bg-muted/20">
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.1} blur={100} />
      </div>

      <GSAPScrollReveal direction="up" distance={40} duration={0.6} className="container mx-auto px-4 text-center max-w-2xl">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
          Get Your Free 7-Day AI Health Plan
        </h2>
        <p className="text-muted-foreground mb-10">
          No credit card. Personalized to your goals. Start in under a minute.
        </p>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl glass-card border border-primary/20 p-8"
          >
            <p className="text-lg font-medium text-primary">Check your inbox.</p>
            <p className="text-muted-foreground text-sm mt-2">
              We&apos;ve sent your free 7-day plan to {email}.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-14 rounded-xl border-white/10 bg-background/80"
                  required
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-14 px-8 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
              >
                Get free plan
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              We never share your email. Unsubscribe anytime.
            </p>
          </form>
        )}
      </GSAPScrollReveal>
    </section>
  );
}
