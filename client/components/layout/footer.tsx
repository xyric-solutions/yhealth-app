"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Mail,
  MapPin,
  Phone,
  ArrowRight,
  Sparkles,
  Activity,
  Heart,
  Brain,
  Shield,
  Award,
  Lock,
  CheckCircle2,
  ChevronRight,
  Zap,
  Globe,
  Star,
  ArrowUp,
} from "lucide-react";

const footerLinks = {
  product: {
    title: "Product",
    icon: Zap,
    links: [
      { label: "Features", href: "#features" },
      { label: "How it Works", href: "#how-it-works" },
      { label: "Pricing", href: "/plans" },
      { label: "Integrations", href: "#integrations" },
      { label: "Mobile App", href: "/app" },
    ],
  },
  company: {
    title: "Company",
    icon: Globe,
    links: [
      { label: "About Us", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Blog", href: "/blogs" },
      { label: "Press", href: "/press" },
      { label: "Contact", href: "/contact" },
    ],
  },
  resources: {
    title: "Resources",
    icon: Star,
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Community", href: "/community" },
      { label: "Webinars", href: "/webinars" },
      { label: "API Docs", href: "#api" },
    ],
  },
  legal: {
    title: "Legal",
    icon: Shield,
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "HIPAA Compliance", href: "/hipaa" },
      { label: "Security", href: "/security" },
    ],
  },
};

const socialLinks = [
  { icon: Facebook, href: "https://facebook.com", label: "Facebook", color: "hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-400/30" },
  { icon: Twitter, href: "https://twitter.com", label: "Twitter", color: "hover:bg-sky-500/20 hover:text-sky-400 hover:border-sky-400/30" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram", color: "hover:bg-pink-500/20 hover:text-pink-400 hover:border-pink-400/30" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn", color: "hover:bg-blue-600/20 hover:text-blue-400 hover:border-blue-400/30" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube", color: "hover:bg-red-500/20 hover:text-red-400 hover:border-red-400/30" },
];

const pillars = [
  { icon: Activity, label: "Fitness", color: "text-cyan-400", bgColor: "bg-cyan-400/10", borderColor: "border-cyan-400/20" },
  { icon: Heart, label: "Nutrition", color: "text-purple-400", bgColor: "bg-purple-400/10", borderColor: "border-purple-400/20" },
  { icon: Brain, label: "Wellbeing", color: "text-pink-400", bgColor: "bg-pink-400/10", borderColor: "border-pink-400/20" },
];

const trustBadges = [
  { icon: Shield, label: "HIPAA Compliant", color: "text-emerald-400" },
  { icon: Lock, label: "256-bit Encryption", color: "text-cyan-400" },
  { icon: Award, label: "SOC 2 Certified", color: "text-purple-400" },
  { icon: CheckCircle2, label: "GDPR Ready", color: "text-pink-400" },
];

export function Footer() {
  const footerRef = useRef(null);
  const newsletterRef = useRef(null);
  const linksRef = useRef(null);
  const bottomRef = useRef(null);
  const newsletterInView = useInView(newsletterRef, { once: true, margin: "-50px" });
  const linksInView = useInView(linksRef, { once: true, margin: "-50px" });
  const bottomInView = useInView(bottomRef, { once: true, margin: "-30px" });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > window.innerHeight * 0.5);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    api.get<{ count: number }>("/newsletter/count").then((res) => {
      if (res.data?.count != null) setSubscriberCount(res.data.count);
    }).catch(() => { /* ignore */ });
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribeError(null);
    setSubscribeLoading(true);
    try {
      await api.post("/newsletter/subscribe", { email: email.trim(), source: "footer" });
      setIsSubscribed(true);
      setEmail("");
      if (subscriberCount != null) setSubscriberCount(subscriberCount + 1);
      setTimeout(() => setIsSubscribed(false), 4000);
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : "Something went wrong.";
      setSubscribeError(message || "Subscription failed. Try again.");
    } finally {
      setSubscribeLoading(false);
    }
  };

  return (
    <footer ref={footerRef} className="relative overflow-hidden">
      {/* ====== ADVANCED BACKGROUND ====== */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
        <div className="absolute inset-0 cyber-grid opacity-[0.07]" />
        {/* Animated gradient orbs */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 15, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/8 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-pink-500/5 rounded-full blur-[80px]"
        />
      </div>

      {/* ====== ANIMATED TOP BORDER ====== */}
      <div className="relative h-px">
        <motion.div
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(168,85,247,0.4), rgba(236,72,153,0.4), transparent)",
            backgroundSize: "200% 100%",
          }}
        />
      </div>

      {/* ====== NEWSLETTER SECTION ====== */}
      <div ref={newsletterRef} className="relative border-b border-white/[0.06]">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={newsletterInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={newsletterInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="inline-flex items-center gap-2 glass-card px-5 py-2.5 rounded-full text-sm font-medium mb-8 border border-white/[0.08]">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                </motion.div>
                <span className="gradient-text font-semibold">Stay Connected</span>
              </div>
            </motion.div>

            {/* Heading */}
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              animate={newsletterInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-3xl md:text-5xl font-bold mb-5 leading-tight"
            >
              Get <span className="gradient-text-animated">AI-Powered</span> Health Tips
            </motion.h3>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={newsletterInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-muted-foreground mb-10 max-w-xl mx-auto text-base md:text-lg"
            >
              Join {(subscriberCount ?? 50000).toLocaleString()}+ health enthusiasts. Get weekly insights, tips, and
              exclusive content delivered straight to your inbox.
            </motion.p>

            {/* Subscribe Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={newsletterInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.25 }}
            >
              <AnimatePresence mode="wait">
                {isSubscribed ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center justify-center gap-3 h-14 glass-card rounded-2xl max-w-md mx-auto border border-emerald-500/20"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                    <span className="text-emerald-400 font-medium">You&apos;re subscribed! Welcome aboard.</span>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubscribe}
                    className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="relative flex-1 group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          required
                          disabled={subscribeLoading}
                          className="flex-1 h-14 pl-11 glass border-white/[0.08] focus:border-primary/50 rounded-2xl text-base"
                        />
                      </div>
                      {subscribeError && (
                        <p className="text-sm text-red-400 text-left">{subscribeError}</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={subscribeLoading}
                      className="h-14 px-8 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 glow-cyan rounded-2xl text-base font-semibold shrink-0"
                    >
                      {subscribeLoading ? "..." : "Subscribe"}
                      {!subscribeLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Three Pillars */}
            <div className="flex justify-center gap-4 sm:gap-6 mt-10 flex-wrap">
              {pillars.map((pillar, index) => (
                <motion.div
                  key={pillar.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={newsletterInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.4, delay: 0.35 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${pillar.bgColor} border ${pillar.borderColor} cursor-default`}
                >
                  <pillar.icon className={`w-4 h-4 ${pillar.color}`} />
                  <span className={`text-sm font-medium ${pillar.color}`}>{pillar.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ====== MAIN FOOTER CONTENT ====== */}
      <div ref={linksRef} className="relative container mx-auto px-4 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand Column */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={linksInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="col-span-2 md:col-span-3 lg:col-span-2"
          >
            <div className="relative inline-block mb-5 overflow-hidden">
              <Logo size="lg" />
              {/* Shimmer sweep */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-12 pointer-events-none"
                animate={{ x: ["-150%", "150%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
              />
            </div>
            <p className="text-muted-foreground mb-8 max-w-sm leading-relaxed">
              Your personal AI life coach. Transform your wellness journey with
              intelligent insights across fitness, nutrition, and wellbeing.
            </p>

            {/* Contact Info */}
            <div className="space-y-3 text-sm text-muted-foreground mb-8">
              {[
                { icon: Mail, text: "hello@balencia.app", color: "group-hover:bg-primary/10" },
                { icon: Phone, text: "+1 (555) 123-4567", color: "group-hover:bg-purple-500/10" },
                { icon: MapPin, text: "San Francisco, CA", color: "group-hover:bg-pink-500/10" },
              ].map((item) => (
                <motion.div
                  key={item.text}
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-3 group cursor-default"
                >
                  <div className={`w-9 h-9 rounded-xl glass border border-white/[0.06] flex items-center justify-center ${item.color} transition-colors duration-300`}>
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="group-hover:text-foreground transition-colors">{item.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-2">
              {trustBadges.map((badge, index) => (
                <motion.div
                  key={badge.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={linksInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]"
                >
                  <badge.icon className={`w-3.5 h-3.5 ${badge.color} flex-shrink-0`} />
                  <span className="text-[11px] text-muted-foreground font-medium">{badge.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([key, section], index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 30 }}
              animate={linksInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <section.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground text-sm">
                  {section.title}
                </h4>
              </div>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-all duration-200"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200 text-primary" />
                      <span>{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ====== BOTTOM BAR ====== */}
      <div ref={bottomRef} className="relative border-t border-white/[0.06]">
        {/* Animated gradient line */}
        <motion.div
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.3) 25%, rgba(168,85,247,0.3) 50%, rgba(236,72,153,0.3) 75%, transparent 100%)",
            backgroundSize: "200% 100%",
          }}
        />

        <div className="container mx-auto px-4 py-8">
          {/* Social + Copyright Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Copyright + Links */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={bottomInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6"
            >
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Balencia. All rights reserved.
              </p>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
                <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <Link href="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
              </div>
            </motion.div>

            {/* Social Links */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={bottomInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex items-center gap-2"
            >
              {socialLinks.map((social) => (
                <motion.div
                  key={social.label}
                  whileHover={{ scale: 1.15, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-10 h-10 rounded-xl glass flex items-center justify-center text-muted-foreground border border-white/[0.06] transition-all duration-300 ${social.color}`}
                    aria-label={social.label}
                  >
                    <social.icon className="h-4 w-4" />
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Made with love tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={bottomInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center justify-center gap-1.5 mt-6 text-xs text-muted-foreground/50"
          >
            <span>Made with</span>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Heart className="w-3 h-3 text-pink-400/60 fill-pink-400/60" />
            </motion.div>
            <span>for a healthier world</span>
          </motion.div>
        </div>
      </div>
      {/* ====== BACK TO TOP BUTTON ====== */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 30 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer"
            aria-label="Back to top"
          >
            {/* Outer pulsing ring */}
            <motion.div
              className="absolute inset-0 rounded-full border border-primary/30"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            {/* Glow behind button */}
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg opacity-60 group-hover:opacity-100 group-hover:blur-xl transition-all duration-500" />
            {/* Main button */}
            <motion.div
              className="relative w-full h-full rounded-full bg-gradient-to-br from-primary via-violet-500 to-purple-600 flex items-center justify-center border border-white/20 shadow-lg shadow-primary/30 overflow-hidden"
              whileHover={{
                boxShadow: "0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(139, 92, 246, 0.2)",
              }}
            >
              {/* Shimmer sweep on hover */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 pointer-events-none translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out"
              />
              {/* Arrow icon with hover lift */}
              <motion.div
                className="relative"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowUp className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-300" />
              </motion.div>
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </footer>
  );
}
