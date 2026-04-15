"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  Heart,
  Lock,
  Users,
  Eye,
  Server,
  AlertTriangle,
  Mail,
  ArrowRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  Shield,
  Database,
  Scale,
  KeyRound,
  Building2,
  ClipboardCheck,
  UserCheck,
  Activity,
  Stethoscope,
  FileSearch,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

const EFFECTIVE_DATE = "January 15, 2026";
const VERSION = "2.0";

const highlights = [
  {
    icon: ShieldCheck,
    title: "HIPAA Compliant",
    description: "Full compliance with HIPAA Privacy & Security Rules",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
  },
  {
    icon: Lock,
    title: "PHI Protected",
    description: "Enterprise-grade safeguards for health information",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    borderColor: "border-cyan-400/20",
  },
  {
    icon: ClipboardCheck,
    title: "Regular Audits",
    description: "Annual third-party HIPAA compliance assessments",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
  },
];

const sections = [
  { id: "overview", label: "HIPAA Overview", icon: FileText },
  { id: "phi", label: "Protected Health Info", icon: Heart },
  { id: "privacy-rule", label: "Privacy Rule", icon: Eye },
  { id: "security-rule", label: "Security Rule", icon: Lock },
  { id: "administrative", label: "Administrative Safeguards", icon: Building2 },
  { id: "physical", label: "Physical Safeguards", icon: Server },
  { id: "technical", label: "Technical Safeguards", icon: KeyRound },
  { id: "breach", label: "Breach Notification", icon: AlertTriangle },
  { id: "baa", label: "Business Associates", icon: Users },
  { id: "your-rights", label: "Your Rights", icon: UserCheck },
  { id: "contact", label: "Contact", icon: Mail },
];

const relatedPages = [
  { label: "Privacy Policy", href: "/privacy", icon: Shield, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  { label: "Terms of Service", href: "/terms", icon: Scale, color: "text-blue-400", bgColor: "bg-blue-400/10" },
  { label: "Cookie Policy", href: "/cookies", icon: Database, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  { label: "Security", href: "/security", icon: Lock, color: "text-purple-400", bgColor: "bg-purple-400/10" },
];

export default function HipaaPageContent() {
  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-50px" });
  const contentInView = useInView(contentRef, { once: true, margin: "-100px" });
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
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
      {/* HERO */}
      <section ref={heroRef} className="relative min-h-[70vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
          <motion.div animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-32 left-[15%] opacity-10">
            <Stethoscope className="w-16 h-16 text-emerald-400" />
          </motion.div>
          <motion.div animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-48 right-[12%] opacity-10">
            <ShieldCheck className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <motion.div animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-32 left-[10%] opacity-10">
            <Activity className="w-14 h-14 text-teal-400" />
          </motion.div>
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-emerald-400 status-online" />
                <span className="text-emerald-400 font-semibold">Compliance</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">HIPAA</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={heroInView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10 text-emerald-400" />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.15 }}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                HIPAA
                <span className="block gradient-text-animated">Compliance</span>
              </h1>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 }}>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Balencia is committed to protecting your health information in accordance with the Health Insurance
                Portability and Accountability Act (HIPAA). Learn about our comprehensive compliance program.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.25 }} className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>Effective: {EFFECTIVE_DATE}</span></div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              <div className="flex items-center gap-2"><FileText className="w-4 h-4" /><span>Version {VERSION}</span></div>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
              {highlights.map((item, index) => (
                <motion.div key={item.title} initial={{ opacity: 0, y: 30 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }} whileHover={{ y: -4, scale: 1.02 }} className={`glass-card p-5 rounded-2xl border ${item.borderColor} text-center group`}>
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

      {/* CONTENT */}
      <section ref={contentRef} className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-8xl mx-auto flex gap-10">
            {/* TOC */}
            <motion.aside initial={{ opacity: 0, x: -30 }} animate={contentInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }} className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24 glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Table of Contents</h3>
                <nav className="space-y-1">
                  {sections.map((s) => (
                    <a key={s.id} href={`#${s.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${activeSection === s.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
                      <s.icon className="w-3.5 h-3.5 flex-shrink-0" /><span>{s.label}</span>
                    </a>
                  ))}
                </nav>
              </div>
            </motion.aside>

            {/* Main */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={contentInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="flex-1 min-w-0">
              <div className="space-y-12">

                {/* Overview */}
                <div id="overview" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
                    <h2 className="text-2xl font-bold">1. HIPAA Overview</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      The Health Insurance Portability and Accountability Act (HIPAA) is a federal law that establishes national standards for protecting sensitive patient health information. As an AI-powered health and wellness platform, Balencia takes HIPAA compliance seriously and has implemented comprehensive safeguards to protect your Protected Health Information (PHI).
                    </p>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">Our Commitment: </span>
                        Balencia maintains a comprehensive HIPAA compliance program that includes administrative, physical, and technical safeguards, annual risk assessments, workforce training, and incident response procedures.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { value: "256-bit", label: "AES Encryption" },
                        { value: "SOC 2", label: "Type II Certified" },
                        { value: "Annual", label: "Risk Assessments" },
                        { value: "100%", label: "Staff Trained" },
                      ].map((stat) => (
                        <div key={stat.label} className="text-center p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <div className="text-xl font-bold text-emerald-400">{stat.value}</div>
                          <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PHI */}
                <div id="phi" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-400/10 flex items-center justify-center"><Heart className="w-5 h-5 text-pink-400" /></div>
                    <h2 className="text-2xl font-bold">2. Protected Health Information (PHI)</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      PHI includes any individually identifiable health information that we create, receive, maintain, or transmit. In the context of Balencia, this includes:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        "Health assessment results and medical history you provide",
                        "Fitness data: workout logs, exercise metrics, body measurements",
                        "Nutrition data: meal logs, dietary preferences, calorie tracking",
                        "Wellbeing data: mood entries, stress levels, sleep patterns",
                        "Wearable device data: heart rate, HRV, SpO2, activity metrics",
                        "AI health coach conversations related to your health",
                        "Voice call recordings and transcripts with health content",
                        "Progress photos and body composition data",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3 p-3 rounded-xl bg-pink-500/5 border border-pink-500/10">
                          <Heart className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Privacy Rule */}
                <div id="privacy-rule" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center"><Eye className="w-5 h-5 text-blue-400" /></div>
                    <h2 className="text-2xl font-bold">3. HIPAA Privacy Rule Compliance</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      The HIPAA Privacy Rule establishes standards for how PHI can be used and disclosed. Balencia complies by:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "Using PHI only for the minimum necessary purpose to provide our health platform services",
                        "Obtaining your written authorization before disclosing PHI for any non-permitted purpose",
                        "Providing you with a Notice of Privacy Practices (this document) explaining your rights",
                        "Allowing you to access, amend, and receive an accounting of disclosures of your PHI",
                        "Training all workforce members on HIPAA privacy requirements annually",
                        "Appointing a dedicated Privacy Officer to oversee compliance",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Security Rule */}
                <div id="security-rule" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center"><Lock className="w-5 h-5 text-cyan-400" /></div>
                    <h2 className="text-2xl font-bold">4. HIPAA Security Rule Compliance</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      The HIPAA Security Rule requires us to implement safeguards to protect electronic PHI (ePHI). Our security program encompasses three categories of safeguards:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { title: "Administrative", desc: "Policies, procedures, risk assessments, and workforce training programs", icon: Building2, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
                        { title: "Physical", desc: "Data center security, access controls, and workstation protections", icon: Server, color: "text-blue-400", bgColor: "bg-blue-400/10" },
                        { title: "Technical", desc: "Encryption, access controls, audit logging, and integrity controls", icon: KeyRound, color: "text-purple-400", bgColor: "bg-purple-400/10" },
                      ].map((item) => (
                        <div key={item.title} className={`p-4 rounded-xl ${item.bgColor} border border-white/5 text-center`}>
                          <item.icon className={`w-8 h-8 ${item.color} mx-auto mb-2`} />
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Administrative Safeguards */}
                <div id="administrative" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-emerald-400" /></div>
                    <h2 className="text-2xl font-bold">5. Administrative Safeguards</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Security Management", desc: "Comprehensive risk analysis and risk management program with documented policies and procedures reviewed annually." },
                        { title: "Workforce Training", desc: "All employees complete HIPAA compliance training during onboarding and annually thereafter, with documented completion records." },
                        { title: "Access Management", desc: "Role-based access controls ensure employees only access PHI necessary for their job functions, with regular access reviews." },
                        { title: "Incident Response", desc: "Documented incident response plan with designated response team, tested through quarterly tabletop exercises." },
                        { title: "Contingency Planning", desc: "Business continuity and disaster recovery plans with regular testing to ensure service availability and data protection." },
                        { title: "Compliance Officer", desc: "Designated HIPAA Privacy and Security Officers responsible for overseeing our compliance program." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Physical Safeguards */}
                <div id="physical" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center"><Server className="w-5 h-5 text-blue-400" /></div>
                    <h2 className="text-2xl font-bold">6. Physical Safeguards</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <ul className="space-y-2">
                      {[
                        "HIPAA-compliant cloud infrastructure hosted on AWS with SOC 2 Type II, ISO 27001, and HITRUST CSF certifications",
                        "Data centers with 24/7 physical security, biometric access controls, and video surveillance",
                        "Geographically distributed data centers with automated failover for high availability",
                        "Secure workstation policies for all employees handling ePHI, including full-disk encryption",
                        "Secure disposal procedures for hardware and media that may have contained ePHI",
                        "Environmental controls including fire suppression, climate control, and power redundancy",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Technical Safeguards */}
                <div id="technical" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center"><KeyRound className="w-5 h-5 text-purple-400" /></div>
                    <h2 className="text-2xl font-bold">7. Technical Safeguards</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { title: "AES-256 Encryption", desc: "All ePHI encrypted at rest using AES-256 encryption standard" },
                        { title: "TLS 1.3", desc: "All data transmitted using TLS 1.3 with perfect forward secrecy" },
                        { title: "Unique User IDs", desc: "Every user assigned a unique identifier for activity tracking" },
                        { title: "Auto Session Timeout", desc: "Automatic session termination after periods of inactivity" },
                        { title: "Comprehensive Audit Logs", desc: "All ePHI access logged with user ID, timestamp, and action details" },
                        { title: "Integrity Controls", desc: "Checksums and hashing to ensure ePHI has not been improperly altered" },
                        { title: "MFA Authentication", desc: "Multi-factor authentication available for all accounts" },
                        { title: "Emergency Access", desc: "Documented emergency access procedures for critical situations" },
                      ].map((item) => (
                        <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                          <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-foreground text-sm">{item.title}: </span>
                            <span className="text-xs text-muted-foreground">{item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Breach Notification */}
                <div id="breach" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
                    <h2 className="text-2xl font-bold">8. Breach Notification</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      In the unlikely event of a breach of unsecured PHI, Balencia will comply with the HIPAA Breach Notification Rule:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Individual Notification", desc: "Affected individuals notified within 60 days of discovering the breach, via email or first-class mail." },
                        { title: "HHS Notification", desc: "Report to the Department of Health and Human Services as required (within 60 days for breaches affecting 500+)." },
                        { title: "Media Notification", desc: "Prominent media outlets in affected states notified if a breach affects 500 or more residents." },
                        { title: "Documentation", desc: "All breach incidents documented with risk assessment, investigation findings, and remediation steps taken." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BAA */}
                <div id="baa" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center"><Users className="w-5 h-5 text-amber-400" /></div>
                    <h2 className="text-2xl font-bold">9. Business Associate Agreements</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      We maintain signed Business Associate Agreements (BAAs) with all third-party vendors and service providers who may access, process, or store PHI on our behalf. These agreements ensure:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "Vendors implement appropriate safeguards for PHI protection",
                        "PHI is only used for the purposes specified in the agreement",
                        "Vendors report any security incidents or breaches promptly",
                        "PHI is returned or destroyed when the business relationship ends",
                        "Vendors allow HHS audits and inspections as required",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                      <FileSearch className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">Vendor Assessment: </span>
                        All business associates undergo security assessments before engagement and are subject to periodic reviews to ensure ongoing compliance.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Your Rights */}
                <div id="your-rights" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-400/10 flex items-center justify-center"><UserCheck className="w-5 h-5 text-pink-400" /></div>
                    <h2 className="text-2xl font-bold">10. Your HIPAA Rights</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">Under HIPAA, you have the following rights regarding your PHI:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Right to Access", desc: "Request and obtain copies of your PHI in electronic or paper format within 30 days." },
                        { title: "Right to Amend", desc: "Request corrections to your PHI if you believe it is inaccurate or incomplete." },
                        { title: "Right to an Accounting", desc: "Receive an accounting of disclosures of your PHI for the past 6 years." },
                        { title: "Right to Restrict", desc: "Request restrictions on how we use or disclose your PHI in certain circumstances." },
                        { title: "Right to Confidential Communications", desc: "Request that we communicate with you about PHI through specific means or at specific locations." },
                        { title: "Right to Complain", desc: "File a complaint with us or with the HHS Office for Civil Rights without retaliation." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div id="contact" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Mail className="w-5 h-5 text-primary" /></div>
                    <h2 className="text-2xl font-bold">11. HIPAA Compliance Contact</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">For HIPAA-related questions, requests, or to file a complaint:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">HIPAA Privacy Officer</h4>
                        <p className="text-xs text-muted-foreground mb-1">Email: hipaa@balencia.app</p>
                        <p className="text-xs text-muted-foreground mb-1">Phone: +1 (555) 123-4567</p>
                        <p className="text-xs text-muted-foreground">Response time: Within 30 days</p>
                      </div>
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">HHS Office for Civil Rights</h4>
                        <p className="text-xs text-muted-foreground mb-1">Website: hhs.gov/ocr</p>
                        <p className="text-xs text-muted-foreground mb-1">Toll-Free: 1-800-368-1019</p>
                        <p className="text-xs text-muted-foreground">File a complaint directly with HHS</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Related */}
              <div className="mt-16">
                <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Related Legal Pages</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {relatedPages.map((page, index) => (
                    <motion.div key={page.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: index * 0.1 }}>
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

              {/* CTA */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-16 glass-card p-8 rounded-3xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
                <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Questions About HIPAA Compliance?</h3>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">Our HIPAA compliance team is ready to address your concerns.</p>
                <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold hover:opacity-90 transition-opacity">
                  Contact Compliance Team <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
