"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Sparkles,
  Shield,
  Zap,
  Users,
  Heart,
  Target,
  Lightbulb,
  Lock,
} from "lucide-react";

const values = [
  {
    icon: Lightbulb,
    title: "Innovation",
    description:
      "We continuously push the boundaries of what's possible in health technology, embracing cutting-edge AI and research to deliver breakthrough solutions.",
    color: "from-amber-400 to-orange-500",
  },
  {
    icon: Shield,
    title: "Security & Privacy",
    description:
      "Your health data is sacred. We implement enterprise-grade security measures and maintain strict privacy standards, ensuring your information remains protected and confidential.",
    color: "from-blue-400 to-cyan-500",
  },
  {
    icon: Heart,
    title: "User-Centricity",
    description:
      "Every feature we build starts with understanding your needs. We design with empathy, ensuring our solutions are intuitive, accessible, and genuinely helpful.",
    color: "from-pink-400 to-rose-500",
  },
  {
    icon: Zap,
    title: "Excellence",
    description:
      "We hold ourselves to the highest standards in everything we do—from code quality to customer support—because your health deserves nothing less than excellence.",
    color: "from-yellow-400 to-amber-500",
  },
  {
    icon: Users,
    title: "Transparency",
    description:
      "We believe in open communication, honest practices, and clear explanations of how our AI works, building trust through transparency in every interaction.",
    color: "from-green-400 to-emerald-500",
  },
  {
    icon: Target,
    title: "Impact-Driven",
    description:
      "We measure success not just by metrics, but by the real-world positive impact we create in people's lives, helping them achieve lasting health improvements.",
    color: "from-purple-400 to-violet-500",
  },
];

export function OurValuesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
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
              <span>Our Values</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              What Drives Us
              <span className="block gradient-text-animated">Every Day</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our core values shape every decision we make, every feature we build, and every
              interaction we have with our community.
            </p>
          </motion.div>

          {/* Values Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card rounded-2xl p-6 lg:p-8 relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
              >
                {/* Gradient Background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${value.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                />

                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${value.color} mb-4 shadow-lg`}
                >
                  <value.icon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {value.description}
                </p>

                {/* Decorative Element */}
                <div
                  className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${value.color} opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`}
                />
              </motion.div>
            ))}
          </div>

          {/* Bottom Statement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-16 text-center max-w-3xl mx-auto"
          >
            <div className="glass-card rounded-2xl p-8 lg:p-10">
              <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
              <p className="text-lg text-foreground leading-relaxed">
                These values aren&apos;t just words on a page—they&apos;re the foundation of our culture and
                the principles that guide us as we build the future of personal health technology.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

