"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Activity,
  Heart,
  Brain,
  Target,
  TrendingUp,
  Sparkles,
  Zap,

} from "lucide-react";

const pillars = [
  {
    icon: Activity,
    title: "Fitness Optimization",
    summary: "AI-powered workout plans that adapt to your progress and goals",
    description:
      "Our intelligent fitness system analyzes your activity patterns, recovery needs, and performance metrics to create personalized workout routines that maximize results while preventing injury and burnout.",
    color: "from-cyan-400 to-cyan-600",
    glowColor: "cyan",
  },
  {
    icon: Heart,
    title: "Nutrition Intelligence",
    summary: "Personalized meal planning and nutritional insights",
    description:
      "Leverage advanced AI to receive tailored nutrition recommendations based on your dietary preferences, health goals, and real-time biometric data, making healthy eating simple and sustainable.",
    color: "from-purple-400 to-purple-600",
    glowColor: "purple",
  },
  {
    icon: Brain,
    title: "Wellbeing Coaching",
    summary: "Holistic mental and emotional health support",
    description:
      "Access 24/7 AI-powered coaching for stress management, sleep optimization, mindfulness practices, and emotional wellness, helping you build resilience and maintain balance in your daily life.",
    color: "from-pink-400 to-pink-600",
    glowColor: "pink",
  },
  {
    icon: Target,
    title: "Goal Achievement",
    summary: "SMART goal framework with intelligent tracking",
    description:
      "Set, track, and achieve your health goals with our proven framework that breaks down ambitious objectives into manageable milestones, providing real-time feedback and adaptive strategies.",
    color: "from-emerald-400 to-emerald-600",
    glowColor: "emerald",
  },
  {
    icon: Zap,
    title: "Real-Time Insights",
    summary: "Instant health analytics and actionable recommendations",
    description:
      "Get immediate insights from your wearable devices, health metrics, and activity patterns, with AI-powered analysis that identifies trends and suggests proactive interventions before issues arise.",
    color: "from-amber-400 to-amber-600",
    glowColor: "amber",
  },
];

export function WhatWeDoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 cyber-grid opacity-5" />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-8xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>What We Do</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Comprehensive Health
              <span className="block gradient-text-animated">Solutions</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We provide end-to-end health and wellness solutions that integrate seamlessly into
              your daily life, powered by advanced AI and backed by scientific research.
            </p>
          </motion.div>

          {/* Pillars Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {pillars.map((pillar, index) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card rounded-2xl p-6 lg:p-8 relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
              >
                {/* Gradient Background on Hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${pillar.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
                />

                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${pillar.color} mb-6 shadow-lg`}
                >
                  <pillar.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl lg:text-2xl font-bold mb-3">{pillar.title}</h3>
                <p className="text-base font-medium text-primary mb-3">{pillar.summary}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {pillar.description}
                </p>

                {/* Decorative Element */}
                <div
                  className={`absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br ${pillar.color} opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`}
                />
              </motion.div>
            ))}
          </div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-center mt-16"
          >
            <p className="text-muted-foreground mb-4">
              Ready to experience the future of personal health?
            </p>
            <a
              href="#why-choose-us"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Discover why thousands trust us
              <TrendingUp className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

