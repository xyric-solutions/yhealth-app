"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Cookie,
  FileText,
  Settings,
  BarChart3,
  Target,
  Shield,
  Lock,
  Database,
  Mail,
  ArrowRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  Scale,
  Eye,
  Sliders,
  Globe,
  Info,
  RefreshCw,
  ToggleLeft,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

const EFFECTIVE_DATE = "January 15, 2026";
const VERSION = "2.0";

const highlights = [
  {
    icon: ToggleLeft,
    title: "Full Control",
    description: "Manage your cookie preferences anytime",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/20",
  },
  {
    icon: Eye,
    title: "Transparent Tracking",
    description: "We clearly explain every cookie we use",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    borderColor: "border-cyan-400/20",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "No third-party advertising trackers",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
  },
];

const sections = [
  { id: "what-are-cookies", label: "What Are Cookies?", icon: Info },
  { id: "cookies-we-use", label: "Cookies We Use", icon: Database },
  { id: "essential", label: "Essential Cookies", icon: Shield },
  { id: "functional", label: "Functional Cookies", icon: Settings },
  { id: "analytics", label: "Analytics Cookies", icon: BarChart3 },
  { id: "marketing", label: "Marketing Cookies", icon: Target },
  { id: "third-party", label: "Third-Party Cookies", icon: Globe },
  { id: "manage", label: "Managing Cookies", icon: Sliders },
  { id: "changes", label: "Policy Updates", icon: RefreshCw },
  { id: "contact", label: "Contact Us", icon: Mail },
];

const cookieTypes = [
  {
    category: "Essential",
    required: true,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    icon: Shield,
    cookies: [
      { name: "balencia_session", purpose: "Maintains your login session across page visits", duration: "Session", provider: "Balencia" },
      { name: "balencia_access_token", purpose: "Authentication token for API requests", duration: "3 days", provider: "Balencia" },
      { name: "balencia_csrf", purpose: "Protects against cross-site request forgery attacks", duration: "Session", provider: "Balencia" },
      { name: "cookie_consent", purpose: "Stores your cookie preference choices", duration: "1 year", provider: "Balencia" },
    ],
  },
  {
    category: "Functional",
    required: false,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
    icon: Settings,
    cookies: [
      { name: "balencia_theme", purpose: "Remembers your dark/light mode preference", duration: "1 year", provider: "Balencia" },
      { name: "balencia_locale", purpose: "Stores your language and region preference", duration: "1 year", provider: "Balencia" },
      { name: "balencia_units", purpose: "Remembers metric or imperial measurement preference", duration: "1 year", provider: "Balencia" },
      { name: "balencia_dashboard", purpose: "Saves your dashboard layout customizations", duration: "1 year", provider: "Balencia" },
    ],
  },
  {
    category: "Analytics",
    required: false,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
    icon: BarChart3,
    cookies: [
      { name: "_ga / _ga_*", purpose: "Google Analytics - tracks page views and user interactions", duration: "2 years", provider: "Google" },
      { name: "_gid", purpose: "Google Analytics - distinguishes unique users", duration: "24 hours", provider: "Google" },
      { name: "ph_*", purpose: "PostHog - product analytics for feature usage tracking", duration: "1 year", provider: "PostHog" },
      { name: "mp_*", purpose: "Mixpanel - event tracking for user journey analysis", duration: "1 year", provider: "Mixpanel" },
    ],
  },
  {
    category: "Marketing",
    required: false,
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
    borderColor: "border-pink-400/20",
    icon: Target,
    cookies: [
      { name: "_fbp", purpose: "Facebook Pixel - measures ad effectiveness (not used for targeting)", duration: "90 days", provider: "Meta" },
      { name: "li_sugr", purpose: "LinkedIn Insight - measures campaign conversions", duration: "90 days", provider: "LinkedIn" },
    ],
  },
];

const relatedPages = [
  { label: "Privacy Policy", href: "/privacy", icon: Shield, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  { label: "Terms of Service", href: "/terms", icon: Scale, color: "text-blue-400", bgColor: "bg-blue-400/10" },
  { label: "HIPAA Compliance", href: "/hipaa", icon: Shield, color: "text-cyan-400", bgColor: "bg-cyan-400/10" },
  { label: "Security", href: "/security", icon: Lock, color: "text-purple-400", bgColor: "bg-purple-400/10" },
];

export default function CookiesPageContent() {
  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-50px" });
  const contentInView = useInView(contentRef, { once: true, margin: "-100px" });
  const [activeSection, setActiveSection] = useState("what-are-cookies");

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
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
          <motion.div animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-32 left-[15%] opacity-10">
            <Cookie className="w-16 h-16 text-amber-400" />
          </motion.div>
          <motion.div animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-48 right-[12%] opacity-10">
            <Sliders className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <motion.div animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-32 left-[10%] opacity-10">
            <Settings className="w-14 h-14 text-orange-400" />
          </motion.div>
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-amber-400 status-online" />
                <span className="text-amber-400 font-semibold">Legal</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Cookies</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={heroInView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center mx-auto">
                <Cookie className="w-10 h-10 text-amber-400" />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.15 }}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                Cookie
                <span className="block gradient-text-animated">Policy</span>
              </h1>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 }}>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                We use cookies to make Balencia work smoothly and improve your experience.
                Here&apos;s exactly what we use, why, and how you can control them.
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
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-orange-500/5 rounded-full blur-3xl" />
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

                {/* What Are Cookies */}
                <div id="what-are-cookies" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center"><Info className="w-5 h-5 text-amber-400" /></div>
                    <h2 className="text-2xl font-bold">1. What Are Cookies?</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently, provide a better user experience, and give website owners useful information about how their site is being used.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      In addition to cookies, we also use similar technologies such as local storage, session storage, and pixel tags. For simplicity, we refer to all of these technologies collectively as &quot;cookies&quot; in this policy.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { title: "Session Cookies", desc: "Temporary cookies deleted when you close your browser" },
                        { title: "Persistent Cookies", desc: "Remain on your device for a set period or until you delete them" },
                        { title: "Third-Party Cookies", desc: "Set by services other than Balencia that we integrate with" },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cookies We Use */}
                <div id="cookies-we-use" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Database className="w-5 h-5 text-primary" /></div>
                    <h2 className="text-2xl font-bold">2. Cookies We Use</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Below is a comprehensive list of all cookies used on the Balencia platform, organized by category. Essential cookies cannot be disabled as they are necessary for the Platform to function.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {cookieTypes.map((type) => (
                        <div key={type.category} className={`p-4 rounded-xl ${type.bgColor} border ${type.borderColor} text-center`}>
                          <type.icon className={`w-6 h-6 ${type.color} mx-auto mb-2`} />
                          <h4 className={`text-sm font-semibold ${type.color}`}>{type.category}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{type.cookies.length} cookies</p>
                          {type.required && <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">Required</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cookie Detail Tables */}
                {cookieTypes.map((type) => (
                  <div key={type.category} id={type.category.toLowerCase()} className="scroll-mt-24">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl ${type.bgColor} flex items-center justify-center`}>
                        <type.icon className={`w-5 h-5 ${type.color}`} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{type.category} Cookies</h2>
                        {type.required && <span className="text-xs text-emerald-400 font-medium">Always Active</span>}
                      </div>
                    </div>
                    <div className="glass-card rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left px-6 py-4 text-xs font-semibold text-foreground uppercase tracking-wider">Cookie Name</th>
                              <th className="text-left px-6 py-4 text-xs font-semibold text-foreground uppercase tracking-wider">Purpose</th>
                              <th className="text-left px-6 py-4 text-xs font-semibold text-foreground uppercase tracking-wider">Duration</th>
                              <th className="text-left px-6 py-4 text-xs font-semibold text-foreground uppercase tracking-wider">Provider</th>
                            </tr>
                          </thead>
                          <tbody>
                            {type.cookies.map((cookie, idx) => (
                              <tr key={cookie.name} className={idx < type.cookies.length - 1 ? "border-b border-white/5" : ""}>
                                <td className="px-6 py-4 font-mono text-xs text-foreground whitespace-nowrap">{cookie.name}</td>
                                <td className="px-6 py-4 text-xs text-muted-foreground">{cookie.purpose}</td>
                                <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">{cookie.duration}</td>
                                <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">{cookie.provider}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Third-Party */}
                <div id="third-party" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center"><Globe className="w-5 h-5 text-blue-400" /></div>
                    <h2 className="text-2xl font-bold">Third-Party Services</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Some cookies are set by third-party services that appear on our pages. We do not control these cookies. Each third-party service has its own privacy policy governing its use of cookies:
                    </p>
                    <ul className="space-y-2">
                      {[
                        { name: "Google Analytics", desc: "Web analytics service that tracks and reports website traffic" },
                        { name: "PostHog", desc: "Product analytics platform for understanding user behavior" },
                        { name: "Stripe", desc: "Payment processing - sets cookies necessary for secure transactions" },
                        { name: "Intercom", desc: "Customer support chat widget (if enabled)" },
                      ].map((item) => (
                        <li key={item.name} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                          <div><span className="font-medium text-foreground">{item.name}: </span><span className="text-muted-foreground text-sm">{item.desc}</span></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Managing */}
                <div id="manage" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center"><Sliders className="w-5 h-5 text-purple-400" /></div>
                    <h2 className="text-2xl font-bold">Managing Your Cookie Preferences</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      You have several options for controlling and managing cookies:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Cookie Banner", desc: "When you first visit Balencia, our cookie banner lets you accept or customize which cookie categories you consent to." },
                        { title: "Platform Settings", desc: "Visit Settings > Privacy in your Balencia account to update your cookie preferences at any time." },
                        { title: "Browser Settings", desc: "Most browsers allow you to block or delete cookies through their privacy settings. Note: blocking essential cookies may break core functionality." },
                        { title: "Opt-Out Links", desc: "For analytics cookies, you can use tools like Google Analytics Opt-out Browser Add-on or NAI Consumer Opt-out." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Changes */}
                <div id="changes" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center"><RefreshCw className="w-5 h-5 text-orange-400" /></div>
                    <h2 className="text-2xl font-bold">Policy Updates</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      We may update this Cookie Policy to reflect changes in the cookies we use or for legal, operational, or regulatory reasons. When we make changes, we will update the effective date at the top of this page and notify you through the Platform.
                    </p>
                  </div>
                </div>

                {/* Contact */}
                <div id="contact" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Mail className="w-5 h-5 text-primary" /></div>
                    <h2 className="text-2xl font-bold">Contact Us</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      If you have questions about our use of cookies or this policy, contact us:
                    </p>
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <p className="text-xs text-muted-foreground mb-1">Email: <a href="mailto:privacy@balencia.app" className="text-primary hover:underline">privacy@balencia.app</a></p>
                      <p className="text-xs text-muted-foreground">Balencia Inc. | 123 Health Innovation Blvd | San Francisco, CA 94105, USA</p>
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
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500" />
                <Sliders className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Want to Update Your Cookie Preferences?</h3>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">Manage your cookie settings anytime from your account privacy settings.</p>
                <Link href="/settings" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold hover:opacity-90 transition-opacity">
                  Open Settings <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
