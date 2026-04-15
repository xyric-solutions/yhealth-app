"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Calendar, Rocket, Users, Award, TrendingUp, Sparkles } from "lucide-react";

const milestones = [
  {
    year: "2023",
    quarter: "Q1",
    title: "Foundation",
    description:
      "Balencia was founded with a vision to make personalized health coaching accessible to everyone through AI technology.",
    icon: Rocket,
    color: "from-cyan-400 to-cyan-600",
  },
  {
    year: "2023",
    quarter: "Q3",
    title: "First 1,000 Users",
    description:
      "Reached our first milestone of 1,000 active users, validating our approach and gathering valuable feedback.",
    icon: Users,
    color: "from-purple-400 to-purple-600",
  },
  {
    year: "2024",
    quarter: "Q1",
    title: "AI Breakthrough",
    description:
      "Launched our advanced AI coaching engine, delivering personalized recommendations with 95% accuracy.",
    icon: Sparkles,
    color: "from-pink-400 to-pink-600",
  },
  {
    year: "2024",
    quarter: "Q3",
    title: "50K Users & Recognition",
    description:
      "Crossed 50,000 active users and received industry recognition for innovation in health technology.",
    icon: Award,
    color: "from-emerald-400 to-emerald-600",
  },
  {
    year: "2025",
    quarter: "Present",
    title: "Continuous Evolution",
    description:
      "Expanding our platform with new features, partnerships, and a commitment to making health accessible globally.",
    icon: TrendingUp,
    color: "from-amber-400 to-amber-600",
  },
];

export function OurJourneySection() {
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
              <Calendar className="w-4 h-4 text-primary" />
              <span>Our Journey</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Building the Future,
              <span className="block gradient-text-animated">One Milestone at a Time</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From a bold idea to a platform trusted by thousands, here&apos;s how we&apos;ve evolved to
              become a leader in AI-powered health solutions.
            </p>
          </motion.div>

          {/* Timeline */}
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-purple-500 to-primary opacity-20" />

            {/* Milestones */}
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={`${milestone.year}-${milestone.quarter}`}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  className={`relative flex items-center gap-8 ${
                    index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  {/* Timeline Dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={`w-16 h-16 rounded-full bg-gradient-to-br ${milestone.color} flex items-center justify-center shadow-lg`}
                    >
                      <milestone.icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  </div>

                  {/* Content Card */}
                  <div
                    className={`flex-1 glass-card rounded-2xl p-6 lg:p-8 ${
                      index % 2 === 0 ? "md:mr-auto md:max-w-md" : "md:ml-auto md:max-w-md"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-semibold text-primary">
                        {milestone.year} {milestone.quarter}
                      </span>
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold mb-3">{milestone.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {milestone.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bottom Statement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-16 text-center max-w-3xl mx-auto"
          >
            <p className="text-lg text-foreground leading-relaxed">
              Our journey is far from over. We&apos;re continuously evolving, learning, and improving
              to better serve our community and make a meaningful impact on global health and
              wellness.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

