"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Target, Eye, Sparkles } from "lucide-react";

export function MissionVisionSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="mission" ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-8xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
            {/* Mission */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="glass-card rounded-2xl p-8 lg:p-10 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-cyan-500 mb-6">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">Our Mission</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                  To democratize access to personalized health and wellness solutions by
                  leveraging artificial intelligence, making professional-grade health coaching
                  available to everyone, regardless of their background or location.
                </p>
                <p className="text-base text-muted-foreground leading-relaxed">
                  We believe that everyone deserves the tools and insights to live their healthiest
                  life, and we&apos;re committed to breaking down barriers that have traditionally made
                  personalized health guidance inaccessible.
                </p>
              </div>
            </motion.div>

            {/* Vision */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-card rounded-2xl p-8 lg:p-10 relative overflow-hidden group"
            >
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 mb-6">
                  <Eye className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">Our Vision</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                  To become the world&apos;s most trusted AI-powered health companion, transforming how
                  millions of people approach wellness by providing actionable, data-driven insights
                  that lead to lasting lifestyle improvements.
                </p>
                <p className="text-base text-muted-foreground leading-relaxed">
                  We envision a future where preventive healthcare is the norm, where individuals
                  have real-time access to personalized health guidance, and where technology
                  seamlessly integrates into daily wellness routines to create meaningful,
                  measurable outcomes.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Core Philosophy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Our Philosophy</span>
            </div>
            <p className="text-xl text-foreground leading-relaxed">
              We combine{" "}
              <span className="gradient-text font-semibold">cutting-edge technology</span> with{" "}
              <span className="gradient-text font-semibold">human-centered design</span> to create
              health solutions that are both powerful and accessible, helping you achieve your
              wellness goals with confidence and clarity.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

