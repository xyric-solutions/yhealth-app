"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Shield,
  Eye,
  Database,
  Lock,
  Users,
  Globe,
  Fingerprint,
  FileText,
  AlertTriangle,
  Mail,
  ArrowRight,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Server,
  UserCheck,
  Clock,
  Baby,
  RefreshCw,
  Scale,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

const EFFECTIVE_DATE = "January 15, 2026";
const VERSION = "2.1";

const highlights = [
  {
    icon: Shield,
    title: "GDPR & CCPA Compliant",
    description: "Full compliance with global data protection regulations",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
  },
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "Your health data is encrypted at rest and in transit",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    borderColor: "border-cyan-400/20",
  },
  {
    icon: UserCheck,
    title: "You Own Your Data",
    description: "Export, modify, or delete your data at any time",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
  },
];

const sections = [
  { id: "introduction", label: "Introduction", icon: FileText },
  { id: "information-we-collect", label: "Information We Collect", icon: Database },
  { id: "how-we-use", label: "How We Use Your Data", icon: Eye },
  { id: "data-sharing", label: "Data Sharing & Disclosure", icon: Users },
  { id: "data-security", label: "Data Security", icon: Lock },
  { id: "your-rights", label: "Your Rights & Choices", icon: Fingerprint },
  { id: "data-retention", label: "Data Retention", icon: Clock },
  { id: "international", label: "International Transfers", icon: Globe },
  { id: "children", label: "Children's Privacy", icon: Baby },
  { id: "changes", label: "Policy Changes", icon: RefreshCw },
  { id: "contact", label: "Contact Us", icon: Mail },
];

const relatedPages = [
  { label: "Terms of Service", href: "/terms", icon: Scale, color: "text-blue-400", bgColor: "bg-blue-400/10" },
  { label: "Cookie Policy", href: "/cookies", icon: Database, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  { label: "HIPAA Compliance", href: "/hipaa", icon: Shield, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  { label: "Security", href: "/security", icon: Lock, color: "text-purple-400", bgColor: "bg-purple-400/10" },
];

export default function PrivacyPageContent() {
  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-50px" });
  const contentInView = useInView(contentRef, { once: true, margin: "-100px" });
  const [activeSection, setActiveSection] = useState("introduction");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <MainLayout>
      {/* ============================================ */}
      {/* HERO SECTION */}
      {/* ============================================ */}
      <section ref={heroRef} className="relative min-h-[70vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-purple-500/8 rounded-full blur-3xl" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
          {/* Floating decorative icons */}
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-32 left-[15%] opacity-10"
          >
            <Shield className="w-16 h-16 text-emerald-400" />
          </motion.div>
          <motion.div
            animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-48 right-[12%] opacity-10"
          >
            <Lock className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <motion.div
            animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-32 left-[10%] opacity-10"
          >
            <Fingerprint className="w-14 h-14 text-purple-400" />
          </motion.div>
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-emerald-400 status-online" />
                <span className="text-emerald-400 font-semibold">Legal</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Privacy</span>
              </div>
            </motion.div>

            {/* Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={heroInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Shield className="w-10 h-10 text-emerald-400" />
              </div>
            </motion.div>

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                Privacy
                <span className="block gradient-text-animated">Policy</span>
              </h1>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Your privacy is fundamental to our mission. This policy explains how Balencia collects,
                uses, and protects your personal and health information with full transparency.
              </p>
            </motion.div>

            {/* Meta Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex items-center justify-center gap-6 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Effective: {EFFECTIVE_DATE}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Version {VERSION}</span>
              </div>
            </motion.div>

            {/* Highlight Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
              {highlights.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={heroInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className={`glass-card p-5 rounded-2xl border ${item.borderColor} text-center group`}
                >
                  <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* CONTENT SECTION */}
      {/* ============================================ */}
      <section ref={contentRef} className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-8xl mx-auto flex gap-10">
            {/* Table of Contents - Desktop Sidebar */}
            <motion.aside
              initial={{ opacity: 0, x: -30 }}
              animate={contentInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="hidden lg:block w-64 flex-shrink-0"
            >
              <div className="sticky top-24 glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Table of Contents
                </h3>
                <nav className="space-y-1">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                        activeSection === section.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                    >
                      <section.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{section.label}</span>
                    </a>
                  ))}
                </nav>
              </div>
            </motion.aside>

            {/* Main Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={contentInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="flex-1 min-w-0"
            >
              <div className="space-y-12">
                {/* Section 1: Introduction */}
                <div id="introduction" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">1. Introduction</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Welcome to Balencia (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). Balencia is an AI-powered personal health and wellness
                      platform that helps you track fitness, nutrition, mental wellbeing, and overall health goals.
                      We are deeply committed to protecting your privacy and ensuring the security of your personal
                      and health-related information.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      This Privacy Policy describes how we collect, use, disclose, and safeguard your information
                      when you use our website, mobile application, API services, and all related services
                      (collectively, the &quot;Platform&quot;). Please read this policy carefully. By using the Platform,
                      you agree to the collection and use of information in accordance with this policy.
                    </p>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">Our Promise: </span>
                        We will never sell your personal health data to third parties. Your health information
                        is used solely to provide and improve your personalized health experience.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Information We Collect */}
                <div id="information-we-collect" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                      <Database className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">2. Information We Collect</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="glass-card rounded-2xl p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-cyan-400" />
                        2.1 Information You Provide
                      </h3>
                      <ul className="space-y-3">
                        {[
                          { title: "Account Information", desc: "Name, email address, date of birth, gender, and profile photo when you create an account." },
                          { title: "Health & Fitness Data", desc: "Weight, height, body measurements, fitness goals, dietary preferences, allergies, medical conditions, and wellness objectives." },
                          { title: "Activity Data", desc: "Workout logs, exercise routines, step counts, nutrition entries, meal photos, water intake, sleep patterns, and mood records." },
                          { title: "Communication Data", desc: "Messages, feedback, support tickets, and any content you submit through our AI health coach or voice assistant." },
                          { title: "Payment Information", desc: "Billing address and payment method details, processed securely through our PCI-compliant payment partners." },
                        ].map((item) => (
                          <li key={item.title} className="flex items-start gap-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-1" />
                            <div>
                              <span className="font-medium text-foreground">{item.title}: </span>
                              <span className="text-muted-foreground text-sm">{item.desc}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="glass-card rounded-2xl p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Server className="w-5 h-5 text-cyan-400" />
                        2.2 Automatically Collected Information
                      </h3>
                      <ul className="space-y-3">
                        {[
                          { title: "Device Information", desc: "Device type, operating system, browser type, unique device identifiers, and mobile network information." },
                          { title: "Usage Data", desc: "Pages visited, features used, interaction patterns, time spent on the platform, and referral sources." },
                          { title: "Location Data", desc: "Approximate location based on IP address. Precise location only with your explicit consent for location-based features." },
                          { title: "Wearable Device Data", desc: "Heart rate, HRV, SpO2, sleep stages, and activity metrics synced from connected devices (e.g., WHOOP, Apple Health, Google Fit)." },
                        ].map((item) => (
                          <li key={item.title} className="flex items-start gap-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-1" />
                            <div>
                              <span className="font-medium text-foreground">{item.title}: </span>
                              <span className="text-muted-foreground text-sm">{item.desc}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Section 3: How We Use Your Data */}
                <div id="how-we-use" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">3. How We Use Your Data</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6">
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      We use the information we collect to provide, maintain, and improve the Balencia Platform. Specifically:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Personalized Health Plans", desc: "Generate AI-driven workout routines, meal plans, and wellness recommendations tailored to your goals." },
                        { title: "AI Health Coaching", desc: "Power our AI health coach and voice assistant with context about your health journey for meaningful conversations." },
                        { title: "Progress Tracking", desc: "Analyze your health metrics, detect trends, and provide insights about your fitness, nutrition, and wellbeing progress." },
                        { title: "Platform Improvement", desc: "Improve our algorithms, features, and user experience through aggregated, anonymized usage analytics." },
                        { title: "Communications", desc: "Send health reminders, workout notifications, progress updates, and important account-related messages." },
                        { title: "Safety & Compliance", desc: "Detect fraud, prevent abuse, enforce our Terms of Service, and comply with applicable legal obligations." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 4: Data Sharing */}
                <div id="data-sharing" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">4. Data Sharing & Disclosure</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">Important: </span>
                        We do <span className="text-amber-400 font-semibold">NOT</span> sell your personal data or
                        health information to advertisers, data brokers, or any third party for marketing purposes.
                      </p>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      We may share your information only in the following limited circumstances:
                    </p>
                    <ul className="space-y-3">
                      {[
                        { title: "Service Providers", desc: "Trusted vendors who help us operate the Platform (cloud hosting, payment processing, email delivery). They are contractually obligated to protect your data and use it only for the services they provide to us." },
                        { title: "Health Integrations", desc: "With your explicit consent, we share data with connected health services (e.g., Apple Health, Google Fit, WHOOP) to provide a unified health experience." },
                        { title: "Legal Requirements", desc: "When required by law, court order, or governmental regulation, or to protect the rights, property, or safety of Balencia, our users, or the public." },
                        { title: "Business Transfers", desc: "In connection with a merger, acquisition, or sale of assets, your information may be transferred. We will notify you before your data becomes subject to a different privacy policy." },
                        { title: "Aggregated Data", desc: "We may share anonymized, aggregated statistical data that cannot identify you personally for research, analytics, or industry reporting purposes." },
                      ].map((item) => (
                        <li key={item.title} className="flex items-start gap-3">
                          <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                          <div>
                            <span className="font-medium text-foreground">{item.title}: </span>
                            <span className="text-muted-foreground text-sm">{item.desc}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Section 5: Data Security */}
                <div id="data-security" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">5. Data Security</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      We implement comprehensive security measures to protect your personal and health information:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        "AES-256 encryption for data at rest",
                        "TLS 1.3 encryption for data in transit",
                        "SOC 2 Type II certified infrastructure",
                        "Regular penetration testing and security audits",
                        "Multi-factor authentication (MFA) support",
                        "Role-based access control (RBAC)",
                        "Real-time intrusion detection systems",
                        "Automated vulnerability scanning",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      For more details about our security practices, visit our{" "}
                      <Link href="/security" className="text-primary hover:underline">Security page</Link>.
                    </p>
                  </div>
                </div>

                {/* Section 6: Your Rights */}
                <div id="your-rights" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-400/10 flex items-center justify-center">
                      <Fingerprint className="w-5 h-5 text-pink-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">6. Your Rights & Choices</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Depending on your location, you have the following rights regarding your personal data:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Right to Access", desc: "Request a copy of all personal data we hold about you in a portable format." },
                        { title: "Right to Rectification", desc: "Correct any inaccurate or incomplete personal information in your account." },
                        { title: "Right to Erasure", desc: "Request deletion of your personal data (\"right to be forgotten\") subject to legal obligations." },
                        { title: "Right to Restrict Processing", desc: "Limit how we process your data in certain circumstances." },
                        { title: "Right to Data Portability", desc: "Receive your data in a structured, machine-readable format to transfer to another service." },
                        { title: "Right to Object", desc: "Object to processing of your data for direct marketing or legitimate interest purposes." },
                        { title: "Right to Withdraw Consent", desc: "Withdraw your consent at any time where processing is based on consent." },
                        { title: "Right to Non-Discrimination", desc: "Exercise your privacy rights without receiving discriminatory treatment from us." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      To exercise any of these rights, contact us at{" "}
                      <a href="mailto:privacy@balencia.app" className="text-primary hover:underline">privacy@balencia.app</a>{" "}
                      or through your account settings. We will respond within 30 days.
                    </p>
                  </div>
                </div>

                {/* Section 7: Data Retention */}
                <div id="data-retention" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">7. Data Retention</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      We retain your personal data only as long as necessary to fulfill the purposes for which it was collected:
                    </p>
                    <ul className="space-y-3">
                      {[
                        { title: "Active Account Data", desc: "Retained for the duration of your account plus 30 days after deletion request for processing." },
                        { title: "Health & Fitness Logs", desc: "Retained while your account is active. Permanently deleted within 90 days of account closure." },
                        { title: "AI Conversation History", desc: "Retained for up to 12 months to improve service quality. You may delete individual conversations at any time." },
                        { title: "Payment Records", desc: "Retained for 7 years to comply with financial regulations and tax requirements." },
                        { title: "Anonymized Analytics", desc: "Aggregated, de-identified data may be retained indefinitely for research and platform improvement." },
                      ].map((item) => (
                        <li key={item.title} className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />
                          <div>
                            <span className="font-medium text-foreground">{item.title}: </span>
                            <span className="text-muted-foreground text-sm">{item.desc}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Section 8: International Transfers */}
                <div id="international" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">8. International Data Transfers</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Balencia operates globally and may transfer your data to countries other than your country
                      of residence. When we transfer data internationally, we ensure adequate protection through:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "EU Standard Contractual Clauses (SCCs) for transfers from the European Economic Area",
                        "UK International Data Transfer Agreements for transfers from the United Kingdom",
                        "Asia-Pacific Economic Cooperation (APEC) Cross-Border Privacy Rules certification",
                        "Binding Corporate Rules for intra-group transfers",
                        "Adequacy decisions where applicable",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Section 9: Children's Privacy */}
                <div id="children" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-400/10 flex items-center justify-center">
                      <Baby className="w-5 h-5 text-pink-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">9. Children&apos;s Privacy</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      The Balencia Platform is not intended for children under the age of 16 (or the applicable age of digital consent
                      in your jurisdiction). We do not knowingly collect personal information from children under 16.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      If we become aware that we have collected personal information from a child under 16 without
                      parental consent, we will take immediate steps to delete that information. If you believe
                      we may have collected data from a child under 16, please contact us at{" "}
                      <a href="mailto:privacy@balencia.app" className="text-primary hover:underline">privacy@balencia.app</a>.
                    </p>
                  </div>
                </div>

                {/* Section 10: Policy Changes */}
                <div id="changes" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-orange-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">10. Changes to This Policy</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      We may update this Privacy Policy from time to time to reflect changes in our practices, technologies,
                      legal requirements, or other factors. When we make material changes:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "We will notify you via email and/or a prominent notice on the Platform at least 30 days before changes take effect",
                        "The \"Effective Date\" at the top of this page will be updated",
                        "For significant changes, we may require you to re-acknowledge the updated policy",
                        "Previous versions of this policy are available upon request",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Section 11: Contact */}
                <div id="contact" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">11. Contact Us</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please reach out:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Data Protection Officer</h4>
                        <p className="text-xs text-muted-foreground mb-1">Email: privacy@balencia.app</p>
                        <p className="text-xs text-muted-foreground mb-1">Phone: +1 (555) 123-4567</p>
                        <p className="text-xs text-muted-foreground">Response time: Within 30 days</p>
                      </div>
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Mailing Address</h4>
                        <p className="text-xs text-muted-foreground">
                          Balencia Inc.<br />
                          Attn: Privacy Team<br />
                          123 Health Innovation Blvd<br />
                          San Francisco, CA 94105, USA
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You also have the right to lodge a complaint with your local data protection supervisory authority.
                    </p>
                  </div>
                </div>
              </div>

              {/* ============================================ */}
              {/* RELATED PAGES */}
              {/* ============================================ */}
              <div className="mt-16">
                <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Related Legal Pages
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {relatedPages.map((page, index) => (
                    <motion.div
                      key={page.label}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                      <Link href={page.href} className="block glass-card p-5 rounded-2xl hover:border-primary/20 transition-all group">
                        <div className={`w-10 h-10 rounded-xl ${page.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                          <page.icon className={`w-5 h-5 ${page.color}`} />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{page.label}</h4>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-2 group-hover:translate-x-1 transition-all" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ============================================ */}
              {/* CTA */}
              {/* ============================================ */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="mt-16 glass-card p-8 rounded-3xl text-center relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500" />
                <Mail className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Have Questions About Your Privacy?</h3>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                  Our privacy team is here to help. Reach out to us anytime.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold hover:opacity-90 transition-opacity"
                >
                  Contact Us
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
