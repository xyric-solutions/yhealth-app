"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Shield,
  Zap,
  Target,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Award,
  Clock,
  Users,
} from "lucide-react";

const differentiators = [
  {
    icon: Zap,
    title: "AI-Powered Intelligence",
    description:
      "Our advanced AI engine learns from your unique patterns and preferences, delivering increasingly personalized recommendations that adapt to your evolving needs.",
    color: "from-amber-400 to-orange-500",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description:
      "Your health data is protected with bank-level encryption, HIPAA compliance, and regular security audits. Privacy and security are non-negotiable.",
    color: "from-blue-400 to-cyan-500",
  },
  {
    icon: Target,
    title: "Proven Results",
    description:
      "98% of our users report measurable improvements in their health metrics within the first 90 days. We focus on outcomes, not just features.",
    color: "from-green-400 to-emerald-500",
  },
  {
    icon: Clock,
    title: "24/7 Availability",
    description:
      "Access personalized coaching, insights, and support whenever you need it. Your AI health companion is always ready, day or night.",
    color: "from-purple-400 to-violet-500",
  },
  {
    icon: TrendingUp,
    title: "Continuous Innovation",
    description:
      "We release new features and improvements regularly, staying at the forefront of health technology and incorporating the latest research.",
    color: "from-pink-400 to-rose-500",
  },
  {
    icon: Users,
    title: "Community Support",
    description:
      "Join a thriving community of health enthusiasts, share experiences, and get support from both our team and fellow users on your wellness journey.",
    color: "from-cyan-400 to-teal-500",
  },
];

const trustMetrics = [
  { icon: Users, value: "50K+", label: "Active Users" },
  { icon: Award, value: "98%", label: "Satisfaction Rate" },
  { icon: TrendingUp, value: "4.9/5", label: "Average Rating" },
  { icon: CheckCircle2, value: "HIPAA", label: "Compliant" },
];

export function WhyChooseUsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="why-choose-us" ref={ref} className="relative py-24 overflow-hidden">
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
              <span>Why Choose Us</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              The Balencia
              <span className="block gradient-text-animated">Advantage</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We&apos;re not just another health app. We&apos;re your trusted partner in achieving lasting
              wellness, backed by cutting-edge technology and a commitment to your success.
            </p>
          </motion.div>

          {/* Trust Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          >
            {trustMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="glass-card rounded-2xl p-6 text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                  <metric.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-2xl lg:text-3xl font-bold gradient-text mb-1">
                  {metric.value}
                </div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Differentiators Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {differentiators.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                className="glass-card rounded-2xl p-6 lg:p-8 relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
              >
                {/* Gradient Background on Hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                />

                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} mb-6 shadow-lg`}
                >
                  <item.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>

                {/* Decorative Element */}
                <div
                  className={`absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br ${item.color} opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`}
                />
              </motion.div>
            ))}
          </div>

          {/* Bottom Statement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 1 }}
            className="mt-16 text-center max-w-3xl mx-auto"
          >
            <div className="glass-card rounded-2xl p-8 lg:p-10">
              <Award className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-4">Reliability You Can Trust</h3>
              <p className="text-lg text-foreground leading-relaxed mb-4">
                We&apos;re committed to being your long-term partner in health. Our platform is built
                for reliability, our team is dedicated to your success, and our technology evolves
                with your needs.
              </p>
              <p className="text-base text-muted-foreground leading-relaxed">
                Join thousands who have transformed their health journey with Balencia. Your
                wellness goals are within reach, and we&apos;re here to help you achieve them.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

