"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  MapPin,
  Briefcase,
  Heart,
  Brain,
  ArrowRight,
  Globe,
  Users,
  Zap,
  Coffee,
  GraduationCap,
  Plane,
  Shield,
  Clock,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

const values = [
  {
    icon: Heart,
    title: "Health First",
    description: "We practice what we preach. Wellness isn't just our product — it's our culture.",
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
  },
  {
    icon: Brain,
    title: "Innovation Driven",
    description: "We push boundaries with AI and technology to solve real health challenges.",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  {
    icon: Users,
    title: "People Centered",
    description: "We build for real people with real health goals. Empathy guides everything we do.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
  },
  {
    icon: Zap,
    title: "Move Fast",
    description: "We ship, iterate, and learn quickly. Perfect is the enemy of progress.",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
];

const benefits = [
  { icon: Shield, label: "Health Insurance", description: "Comprehensive medical, dental & vision" },
  { icon: Coffee, label: "Wellness Stipend", description: "$200/month for fitness & wellbeing" },
  { icon: Plane, label: "Unlimited PTO", description: "Take time when you need it" },
  { icon: Clock, label: "Flexible Hours", description: "Work when you're most productive" },
  { icon: Globe, label: "Remote Friendly", description: "Work from anywhere in the world" },
  { icon: GraduationCap, label: "Learning Budget", description: "$1,500/year for courses & conferences" },
];

const openPositions = [
  {
    title: "Senior Full-Stack Engineer",
    department: "Engineering",
    location: "Remote / San Francisco",
    type: "Full-time",
    tags: ["React", "Node.js", "TypeScript", "PostgreSQL"],
  },
  {
    title: "ML/AI Engineer",
    department: "AI & Data",
    location: "Remote / San Francisco",
    type: "Full-time",
    tags: ["Python", "TensorFlow", "NLP", "RAG"],
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote",
    type: "Full-time",
    tags: ["Figma", "Design Systems", "UX Research"],
  },
  {
    title: "Health Content Writer",
    department: "Content",
    location: "Remote",
    type: "Full-time",
    tags: ["Health Writing", "SEO", "Medical Review"],
  },
  {
    title: "Growth Marketing Manager",
    department: "Marketing",
    location: "Remote / San Francisco",
    type: "Full-time",
    tags: ["Growth", "Analytics", "Content Marketing"],
  },
  {
    title: "Mobile Developer (React Native)",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    tags: ["React Native", "iOS", "Android", "TypeScript"],
  },
];

export default function CareersPageContent() {
  const heroRef = useRef(null);
  const valuesRef = useRef(null);
  const benefitsRef = useRef(null);
  const positionsRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const valuesInView = useInView(valuesRef, { once: true, margin: "-100px" });
  const benefitsInView = useInView(benefitsRef, { once: true, margin: "-100px" });
  const positionsInView = useInView(positionsRef, { once: true, margin: "-100px" });

  return (
    <MainLayout>
      {/* HERO SECTION */}
      <section ref={heroRef} className="relative min-h-[60vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium">
                <Briefcase className="w-4 h-4 text-primary" />
                <span className="gradient-text font-semibold">Careers</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight"
            >
              Build the Future of
              <span className="block gradient-text-animated">Personal Health</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Join a passionate team using AI to make personalized healthcare accessible to
              everyone. We&apos;re hiring talented people who want to make a real impact.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                <span>Remote & San Francisco</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4 text-primary" />
                <span>Growing Team of 30+</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="w-4 h-4 text-primary" />
                <span>Global Impact</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <a
                href="#positions"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold hover:from-emerald-600 hover:to-sky-600 transition-all glow-cyan"
              >
                View Open Positions
                <ArrowRight className="w-5 h-5" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* VALUES SECTION */}
      <section ref={valuesRef} className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={valuesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Our <span className="gradient-text">Values</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              The principles that guide how we work, build, and grow together
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                animate={valuesInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-card p-6 rounded-2xl text-center group"
              >
                <div className={`w-12 h-12 rounded-xl ${value.bgColor} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                  <value.icon className={`w-6 h-6 ${value.color}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS SECTION */}
      <section ref={benefitsRef} className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Perks & <span className="gradient-text">Benefits</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              We take care of our team so they can take care of the world&apos;s health
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.label}
                initial={{ opacity: 0, y: 15 }}
                animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="glass-card p-5 rounded-2xl flex items-start gap-4 group hover:border-primary/20 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <benefit.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">{benefit.label}</h3>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* OPEN POSITIONS SECTION */}
      <section ref={positionsRef} id="positions" className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={positionsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Open <span className="gradient-text">Positions</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Find your next role and help us transform personal health
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-4">
            {openPositions.map((position, index) => (
              <motion.div
                key={position.title}
                initial={{ opacity: 0, y: 15 }}
                animate={positionsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <div className="glass-card p-6 rounded-2xl group hover:border-primary/20 transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                        {position.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {position.department}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {position.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {position.type}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {position.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Can't find your role CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={positionsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="max-w-3xl mx-auto mt-8 text-center"
          >
            <div className="glass-card p-8 rounded-2xl">
              <h3 className="text-lg font-bold mb-2">Don&apos;t See Your Role?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We&apos;re always looking for talented people. Send us your resume and let us know how you can contribute.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold text-sm hover:from-emerald-600 hover:to-sky-600 transition-all"
              >
                Get in Touch
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
