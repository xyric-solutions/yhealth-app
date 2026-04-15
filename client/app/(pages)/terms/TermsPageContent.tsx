"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Scale,
  FileText,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  Ban,
  CreditCard,
  Copyright,
  Gavel,
  Mail,
  ArrowRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  Shield,
  Lock,
  Database,
  XCircle,
  BookOpen,
  RefreshCw,
  Globe,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

const EFFECTIVE_DATE = "January 15, 2026";
const VERSION = "2.1";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Fair & Transparent",
    description: "Clear terms with no hidden clauses or gotchas",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
  },
  {
    icon: UserCheck,
    title: "User-Friendly",
    description: "Written in plain language you can actually understand",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
  },
  {
    icon: Gavel,
    title: "Legally Sound",
    description: "Reviewed by legal experts and updated regularly",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
  },
];

const sections = [
  { id: "acceptance", label: "Acceptance of Terms", icon: FileText },
  { id: "eligibility", label: "Eligibility", icon: UserCheck },
  { id: "account", label: "Your Account", icon: ShieldCheck },
  { id: "platform-use", label: "Platform Usage", icon: BookOpen },
  { id: "prohibited", label: "Prohibited Conduct", icon: Ban },
  { id: "health-disclaimer", label: "Health Disclaimer", icon: AlertTriangle },
  { id: "intellectual-property", label: "Intellectual Property", icon: Copyright },
  { id: "payment", label: "Payments & Subscriptions", icon: CreditCard },
  { id: "termination", label: "Termination", icon: XCircle },
  { id: "limitation", label: "Limitation of Liability", icon: Scale },
  { id: "governing-law", label: "Governing Law", icon: Globe },
  { id: "changes", label: "Changes to Terms", icon: RefreshCw },
  { id: "contact", label: "Contact", icon: Mail },
];

const relatedPages = [
  { label: "Privacy Policy", href: "/privacy", icon: Shield, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  { label: "Cookie Policy", href: "/cookies", icon: Database, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  { label: "HIPAA Compliance", href: "/hipaa", icon: ShieldCheck, color: "text-cyan-400", bgColor: "bg-cyan-400/10" },
  { label: "Security", href: "/security", icon: Lock, color: "text-purple-400", bgColor: "bg-purple-400/10" },
];

export default function TermsPageContent() {
  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-50px" });
  const contentInView = useInView(contentRef, { once: true, margin: "-100px" });
  const [activeSection, setActiveSection] = useState("acceptance");

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
      {/* HERO */}
      <section ref={heroRef} className="relative min-h-[70vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
          <motion.div animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-32 left-[15%] opacity-10">
            <Scale className="w-16 h-16 text-blue-400" />
          </motion.div>
          <motion.div animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-48 right-[12%] opacity-10">
            <Gavel className="w-12 h-12 text-purple-400" />
          </motion.div>
          <motion.div animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-32 left-[10%] opacity-10">
            <FileText className="w-14 h-14 text-cyan-400" />
          </motion.div>
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-blue-400 status-online" />
                <span className="text-blue-400 font-semibold">Legal</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Terms</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={heroInView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Scale className="w-10 h-10 text-blue-400" />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.15 }}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                Terms of
                <span className="block gradient-text-animated">Service</span>
              </h1>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 }}>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                These terms govern your use of the Balencia platform. We&apos;ve written them in plain
                language so you can understand exactly what you&apos;re agreeing to.
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
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-8xl mx-auto flex gap-10">
            {/* TOC Sidebar */}
            <motion.aside initial={{ opacity: 0, x: -30 }} animate={contentInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }} className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24 glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Table of Contents
                </h3>
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

                {/* 1 Acceptance */}
                <div id="acceptance" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
                    <h2 className="text-2xl font-bold">1. Acceptance of Terms</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      By accessing or using the Balencia platform, website, mobile application, or any of our services (collectively, the &quot;Platform&quot;),
                      you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you must not access or use the Platform.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      These Terms constitute a legally binding agreement between you and Balencia Inc. (&quot;Balencia,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
                      They apply to all users of the Platform, including visitors, registered users, and subscribers.
                    </p>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">Important: </span>
                        These Terms include an arbitration clause and class action waiver in Section 10 that affect your legal rights. Please review carefully.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2 Eligibility */}
                <div id="eligibility" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center"><UserCheck className="w-5 h-5 text-emerald-400" /></div>
                    <h2 className="text-2xl font-bold">2. Eligibility</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">To use the Balencia Platform, you must:</p>
                    <ul className="space-y-2">
                      {[
                        "Be at least 16 years of age (or the age of digital consent in your jurisdiction)",
                        "Have the legal capacity to enter into a binding agreement",
                        "Not be prohibited from using the Platform under applicable laws",
                        "Provide accurate and complete registration information",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-1" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      If you are using the Platform on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
                    </p>
                  </div>
                </div>

                {/* 3 Account */}
                <div id="account" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-cyan-400" /></div>
                    <h2 className="text-2xl font-bold">3. Your Account</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      When you create an account, you are responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Account Security", desc: "Use a strong password and enable multi-factor authentication. Notify us immediately of any unauthorized access." },
                        { title: "Accurate Information", desc: "You agree to provide and maintain accurate, current, and complete account information at all times." },
                        { title: "One Account Per Person", desc: "You may not create multiple accounts or share your account credentials with others." },
                        { title: "Account Responsibility", desc: "You are solely responsible for all activity on your account, whether or not authorized by you." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4 Platform Use */}
                <div id="platform-use" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center"><BookOpen className="w-5 h-5 text-purple-400" /></div>
                    <h2 className="text-2xl font-bold">4. Platform Usage</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Balencia grants you a limited, non-exclusive, non-transferable, revocable license to use the Platform for your personal, non-commercial health and wellness purposes, subject to these Terms.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { title: "Personal Use", desc: "Track your health, fitness, nutrition, and wellbeing using our tools and AI features." },
                        { title: "AI Health Coaching", desc: "Interact with our AI health coach for personalized guidance and recommendations." },
                        { title: "Data Syncing", desc: "Connect wearable devices and health apps to centralize your health data." },
                        { title: "Community Features", desc: "Participate in community features in accordance with our Community Guidelines." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5 Prohibited */}
                <div id="prohibited" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center"><Ban className="w-5 h-5 text-red-400" /></div>
                    <h2 className="text-2xl font-bold">5. Prohibited Conduct</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        "Reverse engineer, decompile, or disassemble any part of the Platform",
                        "Use the Platform for any illegal or unauthorized purpose",
                        "Attempt to gain unauthorized access to other users' accounts or data",
                        "Use automated scripts, bots, or scrapers to access the Platform",
                        "Upload malicious code, viruses, or harmful content",
                        "Impersonate any person or entity or misrepresent your affiliation",
                        "Interfere with or disrupt the Platform's infrastructure or security",
                        "Use the Platform to provide medical advice or diagnoses to others",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 6 Health Disclaimer */}
                <div id="health-disclaimer" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-400" /></div>
                    <h2 className="text-2xl font-bold">6. Health & Medical Disclaimer</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-foreground font-semibold text-sm mb-1">Critical Notice</p>
                        <p className="text-sm text-muted-foreground">
                          Balencia is <span className="text-amber-400 font-semibold">NOT</span> a medical device, medical provider, or substitute for professional medical advice, diagnosis, or treatment.
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {[
                        "The AI health coach and all platform features are for informational and educational purposes only",
                        "Always consult a qualified healthcare professional before starting any new exercise, nutrition, or wellness program",
                        "Never disregard professional medical advice or delay seeking treatment based on information from Balencia",
                        "If you experience a medical emergency, call your local emergency services immediately",
                        "Individual results may vary based on health status, genetics, adherence, and other factors",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 7 IP */}
                <div id="intellectual-property" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-400/10 flex items-center justify-center"><Copyright className="w-5 h-5 text-pink-400" /></div>
                    <h2 className="text-2xl font-bold">7. Intellectual Property</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      The Platform, including all content, features, functionality, software, algorithms, designs, and trademarks, is owned by Balencia Inc. and protected by intellectual property laws worldwide.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Our Content</h4>
                        <p className="text-xs text-muted-foreground">All text, graphics, logos, icons, images, audio, video, data compilations, and software on the Platform are our property or licensed to us.</p>
                      </div>
                      <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Your Content</h4>
                        <p className="text-xs text-muted-foreground">You retain ownership of content you create (logs, notes, photos). By uploading content, you grant us a license to use it to provide and improve our services.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 8 Payment */}
                <div id="payment" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center"><CreditCard className="w-5 h-5 text-emerald-400" /></div>
                    <h2 className="text-2xl font-bold">8. Payments & Subscriptions</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Balencia offers both free and premium subscription plans. By subscribing to a paid plan, you agree to the following:
                    </p>
                    <ul className="space-y-2">
                      {[
                        { title: "Billing", desc: "Subscription fees are billed in advance on a recurring basis (monthly or annually) based on your chosen plan." },
                        { title: "Auto-Renewal", desc: "Subscriptions automatically renew unless you cancel at least 24 hours before the renewal date." },
                        { title: "Price Changes", desc: "We may change subscription prices with at least 30 days' prior notice. Existing subscribers retain their current price until the next renewal." },
                        { title: "Refunds", desc: "We offer a 14-day money-back guarantee for new subscriptions. After this period, refunds are at our discretion." },
                        { title: "Free Trial", desc: "If offered a free trial, you will be charged the subscription fee at the end of the trial unless you cancel beforehand." },
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

                {/* 9 Termination */}
                <div id="termination" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center"><XCircle className="w-5 h-5 text-red-400" /></div>
                    <h2 className="text-2xl font-bold">9. Termination</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Either party may terminate this agreement at any time:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <h4 className="text-sm font-semibold text-foreground mb-1">You May Terminate</h4>
                        <p className="text-xs text-muted-foreground">Delete your account at any time through Settings. We will delete your data in accordance with our Privacy Policy retention schedule.</p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <h4 className="text-sm font-semibold text-foreground mb-1">We May Terminate</h4>
                        <p className="text-xs text-muted-foreground">Suspend or terminate your account for violation of these Terms, with notice except in cases requiring immediate action for safety or security.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 10 Limitation */}
                <div id="limitation" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center"><Scale className="w-5 h-5 text-blue-400" /></div>
                    <h2 className="text-2xl font-bold">10. Limitation of Liability</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      TO THE MAXIMUM EXTENT PERMITTED BY LAW, YHEALTH AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Our total liability for any claims arising under these Terms shall not exceed the greater of (a) the amount you paid us in the 12 months preceding the claim, or (b) $100 USD.
                    </p>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Some jurisdictions do not allow the exclusion or limitation of certain damages. In such jurisdictions, our liability is limited to the fullest extent permitted by law.
                    </p>
                  </div>
                </div>

                {/* 11 Governing Law */}
                <div id="governing-law" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center"><Globe className="w-5 h-5 text-purple-400" /></div>
                    <h2 className="text-2xl font-bold">11. Governing Law & Dispute Resolution</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      These Terms are governed by the laws of the State of California, USA, without regard to conflict of law principles. Any disputes arising from these Terms or the Platform shall be resolved through binding arbitration administered by the American Arbitration Association (AAA) in San Francisco, California.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      You agree that any arbitration shall be conducted on an individual basis and not as a class, consolidated, or representative action. You waive any right to participate in a class action lawsuit or class-wide arbitration.
                    </p>
                  </div>
                </div>

                {/* 12 Changes */}
                <div id="changes" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center"><RefreshCw className="w-5 h-5 text-orange-400" /></div>
                    <h2 className="text-2xl font-bold">12. Changes to These Terms</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      We reserve the right to modify these Terms at any time. We will provide at least 30 days&apos; notice for material changes via email or a prominent Platform notice. Continued use after the effective date constitutes acceptance of the revised Terms.
                    </p>
                  </div>
                </div>

                {/* 13 Contact */}
                <div id="contact" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Mail className="w-5 h-5 text-primary" /></div>
                    <h2 className="text-2xl font-bold">13. Contact</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">For questions about these Terms, contact us:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Legal Department</h4>
                        <p className="text-xs text-muted-foreground mb-1">Email: legal@balencia.app</p>
                        <p className="text-xs text-muted-foreground">Phone: +1 (555) 123-4567</p>
                      </div>
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Mailing Address</h4>
                        <p className="text-xs text-muted-foreground">Balencia Inc.<br />Attn: Legal Team<br />123 Health Innovation Blvd<br />San Francisco, CA 94105, USA</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Related Pages */}
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
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                <Mail className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Questions About Our Terms?</h3>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">Our legal team is happy to clarify anything. Don&apos;t hesitate to reach out.</p>
                <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold hover:opacity-90 transition-opacity">
                  Contact Us <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
