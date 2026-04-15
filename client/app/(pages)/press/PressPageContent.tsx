"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Newspaper,
  Download,

  ArrowRight,

  Mail,
  Calendar,
  TrendingUp,
  Award,
  Users,
  Globe,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

const pressStats = [
  { label: "Users Worldwide", value: "50K+", icon: Users, color: "text-cyan-400" },
  { label: "Countries", value: "120+", icon: Globe, color: "text-purple-400" },
  { label: "Data Points Tracked", value: "10M+", icon: TrendingUp, color: "text-pink-400" },
  { label: "Awards Won", value: "5", icon: Award, color: "text-amber-400" },
];

const pressReleases = [
  {
    date: "January 15, 2026",
    title: "Balencia Launches AI-Powered Voice Health Coach",
    excerpt: "Balencia introduces real-time voice conversations with an AI health coach, bringing personalized wellness guidance through natural voice interaction.",
    tag: "Product Launch",
  },
  {
    date: "December 5, 2025",
    title: "Balencia Surpasses 50,000 Active Users",
    excerpt: "The AI-powered health platform reaches a major milestone, demonstrating strong user engagement and retention across fitness, nutrition, and wellbeing features.",
    tag: "Milestone",
  },
  {
    date: "November 20, 2025",
    title: "Balencia Partners with WHOOP for Deep Health Analytics",
    excerpt: "New integration brings WHOOP's advanced recovery, strain, and sleep data directly into the Balencia AI coaching experience.",
    tag: "Partnership",
  },
  {
    date: "October 8, 2025",
    title: "Balencia Introduces Mental Wellbeing Pillar",
    excerpt: "Comprehensive mental health features including mood tracking, stress detection, guided breathing, and AI-powered emotional check-ins launch on the platform.",
    tag: "Product Update",
  },
  {
    date: "September 1, 2025",
    title: "Balencia Named Top Health Tech Startup to Watch",
    excerpt: "Leading industry publications recognize Balencia's innovative approach to AI-driven personalized healthcare and wellness coaching.",
    tag: "Recognition",
  },
];

const mediaFeatures = [
  { name: "TechCrunch", quote: "Balencia is redefining what personalized health coaching looks like in the AI era." },
  { name: "Forbes Health", quote: "A comprehensive platform that bridges the gap between fitness tracking and actual health improvement." },
  { name: "Wired", quote: "The voice AI coach feature makes wellness guidance feel genuinely human and accessible." },
  { name: "VentureBeat", quote: "Balencia's three-pillar approach to fitness, nutrition, and wellbeing sets a new standard for health apps." },
];

const brandAssets = [
  { label: "Logo Pack", description: "SVG, PNG formats in light & dark variants", format: "ZIP" },
  { label: "Brand Guidelines", description: "Colors, typography, usage rules", format: "PDF" },
  { label: "Product Screenshots", description: "High-res app screenshots for press", format: "ZIP" },
  { label: "Founder Photos", description: "Headshots and team photos", format: "ZIP" },
];

export default function PressPageContent() {
  const heroRef = useRef(null);
  const releasesRef = useRef(null);
  const mediaRef = useRef(null);
  const assetsRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const releasesInView = useInView(releasesRef, { once: true, margin: "-100px" });
  const mediaInView = useInView(mediaRef, { once: true, margin: "-100px" });
  const assetsInView = useInView(assetsRef, { once: true, margin: "-100px" });

  return (
    <MainLayout>
      {/* HERO SECTION */}
      <section ref={heroRef} className="relative min-h-[50vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
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
                <Newspaper className="w-4 h-4 text-primary" />
                <span className="gradient-text font-semibold">Press & Media</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
            >
              Balencia in the <span className="gradient-text">News</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Latest press releases, media coverage, and brand assets. For press inquiries,
              reach out to our communications team.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <a
                href="mailto:press@balencia.app"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold hover:from-emerald-600 hover:to-sky-600 transition-all glow-cyan"
              >
                <Mail className="w-5 h-5" />
                Press Inquiries
              </a>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 max-w-3xl mx-auto">
              {pressStats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={heroInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                  className="glass-card p-4 rounded-2xl text-center"
                >
                  <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MEDIA QUOTES SECTION */}
      <section ref={mediaRef} className="relative py-16 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mediaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              What the Media <span className="gradient-text">Says</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {mediaFeatures.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                animate={mediaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="glass-card p-6 rounded-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-sky-500" />
                <p className="text-sm text-muted-foreground italic mb-4 leading-relaxed">
                  &ldquo;{feature.quote}&rdquo;
                </p>
                <p className="text-sm font-semibold text-primary">{feature.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRESS RELEASES SECTION */}
      <section ref={releasesRef} className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={releasesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Press <span className="gradient-text">Releases</span>
            </h2>
            <p className="text-muted-foreground">Latest news and announcements from Balencia</p>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-4">
            {pressReleases.map((release, index) => (
              <motion.div
                key={release.title}
                initial={{ opacity: 0, y: 15 }}
                animate={releasesInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="glass-card p-6 rounded-2xl group hover:border-primary/20 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        {release.tag}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {release.date}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                      {release.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{release.excerpt}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BRAND ASSETS SECTION */}
      <section ref={assetsRef} className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={assetsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Brand <span className="gradient-text">Assets</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Download official logos, guidelines, and media resources
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {brandAssets.map((asset, index) => (
              <motion.div
                key={asset.label}
                initial={{ opacity: 0, y: 15 }}
                animate={assetsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="glass-card p-5 rounded-2xl flex items-center gap-4 group hover:border-primary/20 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">{asset.label}</h3>
                  <p className="text-xs text-muted-foreground">{asset.description}</p>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                  {asset.format}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Press Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={assetsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="max-w-3xl mx-auto mt-12 text-center glass-card p-8 rounded-3xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-sky-600" />
            <h3 className="text-xl font-bold mb-2">Press Contact</h3>
            <p className="text-sm text-muted-foreground mb-4">
              For interviews, media inquiries, or additional information about Balencia
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:press@balencia.app"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold text-sm hover:from-emerald-600 hover:to-sky-600 transition-all"
              >
                <Mail className="w-4 h-4" />
                press@balencia.app
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl glass border border-white/10 text-foreground font-semibold text-sm hover:border-primary/30 transition-all"
              >
                Contact Form
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
