"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Shield,
  Lock,
  FileText,
  Server,
  KeyRound,
  Eye,
  AlertTriangle,
  Mail,
  ArrowRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  Database,
  Scale,
  ShieldCheck,
  Fingerprint,
  Network,
  Bug,
  Activity,
  Zap,
  Radio,
  ScanLine,
  RefreshCw,
  CloudCog,
} from "lucide-react";
import { MainLayout } from "@/components/layout";

const EFFECTIVE_DATE = "January 15, 2026";

const highlights = [
  {
    icon: Lock,
    title: "AES-256 Encryption",
    description: "Military-grade encryption for all health data at rest",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
  },
  {
    icon: ShieldCheck,
    title: "SOC 2 Type II",
    description: "Independently audited security controls annually",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    borderColor: "border-cyan-400/20",
  },
  {
    icon: Bug,
    title: "Bug Bounty Program",
    description: "Rewarding ethical hackers who help us stay secure",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
  },
];

const sections = [
  { id: "overview", label: "Security Overview", icon: Shield },
  { id: "infrastructure", label: "Infrastructure", icon: Server },
  { id: "encryption", label: "Encryption", icon: Lock },
  { id: "access-control", label: "Access Control", icon: KeyRound },
  { id: "monitoring", label: "Monitoring & Detection", icon: Eye },
  { id: "network", label: "Network Security", icon: Network },
  { id: "application", label: "Application Security", icon: ScanLine },
  { id: "testing", label: "Security Testing", icon: Bug },
  { id: "incident-response", label: "Incident Response", icon: AlertTriangle },
  { id: "compliance", label: "Certifications", icon: ShieldCheck },
  { id: "responsible-disclosure", label: "Responsible Disclosure", icon: Fingerprint },
  { id: "contact", label: "Contact", icon: Mail },
];

const certifications = [
  { name: "SOC 2 Type II", status: "Certified", desc: "Annual audit of security, availability, and confidentiality controls", color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  { name: "HIPAA", status: "Compliant", desc: "Full compliance with healthcare data protection standards", color: "text-cyan-400", bgColor: "bg-cyan-400/10" },
  { name: "GDPR", status: "Compliant", desc: "European data protection regulation compliance", color: "text-blue-400", bgColor: "bg-blue-400/10" },
  { name: "CCPA", status: "Compliant", desc: "California consumer privacy act compliance", color: "text-purple-400", bgColor: "bg-purple-400/10" },
  { name: "ISO 27001", status: "In Progress", desc: "Information security management system certification", color: "text-amber-400", bgColor: "bg-amber-400/10" },
  { name: "PCI DSS", status: "Compliant", desc: "Payment card industry data security standards via Stripe", color: "text-pink-400", bgColor: "bg-pink-400/10" },
];

const relatedPages = [
  { label: "Privacy Policy", href: "/privacy", icon: Shield, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
  { label: "Terms of Service", href: "/terms", icon: Scale, color: "text-blue-400", bgColor: "bg-blue-400/10" },
  { label: "Cookie Policy", href: "/cookies", icon: Database, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  { label: "HIPAA Compliance", href: "/hipaa", icon: ShieldCheck, color: "text-cyan-400", bgColor: "bg-cyan-400/10" },
];

export default function SecurityPageContent() {
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
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-blue-500/8 rounded-full blur-3xl" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
          <motion.div animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-32 left-[15%] opacity-10">
            <Shield className="w-16 h-16 text-purple-400" />
          </motion.div>
          <motion.div animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-48 right-[12%] opacity-10">
            <Lock className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <motion.div animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-32 left-[10%] opacity-10">
            <Fingerprint className="w-14 h-14 text-blue-400" />
          </motion.div>
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-purple-400 status-online" />
                <span className="text-purple-400 font-semibold">Trust & Safety</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Security</span>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={heroInView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/20 flex items-center justify-center mx-auto">
                <Shield className="w-10 h-10 text-purple-400" />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.15 }}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                Security at
                <span className="block gradient-text-animated">Balencia</span>
              </h1>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 }}>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Your health data deserves the highest level of protection. Explore our enterprise-grade
                security infrastructure, encryption standards, and compliance certifications.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.25 }} className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>Last Updated: {EFFECTIVE_DATE}</span></div>
            </motion.div>

            {/* Stats Row */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.3 }} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12">
              {[
                { value: "99.99%", label: "Uptime SLA", icon: Activity },
                { value: "AES-256", label: "Encryption", icon: Lock },
                { value: "24/7", label: "Monitoring", icon: Radio },
                { value: "< 1hr", label: "Incident Response", icon: Zap },
              ].map((stat, index) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, delay: 0.35 + index * 0.1 }} className="glass-card p-4 rounded-2xl text-center">
                  <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              {highlights.map((item, index) => (
                <motion.div key={item.title} initial={{ opacity: 0, y: 30 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }} whileHover={{ y: -4, scale: 1.02 }} className={`glass-card p-5 rounded-2xl border ${item.borderColor} text-center group`}>
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
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl" />
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
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Shield className="w-5 h-5 text-primary" /></div>
                    <h2 className="text-2xl font-bold">Security Overview</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      At Balencia, security is not an afterthought—it&apos;s built into every layer of our platform. As a health and wellness platform handling sensitive personal and health data, we maintain enterprise-grade security controls that meet and exceed industry standards.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Our security program is led by a dedicated security team and follows the defense-in-depth principle, implementing multiple layers of security controls across infrastructure, application, data, and operational domains.
                    </p>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">Security-First Culture: </span>
                        Every engineer at Balencia receives security training and follows secure development practices. Security reviews are mandatory for all code changes.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Infrastructure */}
                <div id="infrastructure" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center"><Server className="w-5 h-5 text-cyan-400" /></div>
                    <h2 className="text-2xl font-bold">Infrastructure Security</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Balencia is hosted on enterprise-grade cloud infrastructure with multiple layers of physical and logical security:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Cloud Provider", desc: "Hosted on AWS with SOC 2, ISO 27001, HITRUST, and FedRAMP certifications. Multi-AZ deployment for high availability.", icon: CloudCog },
                        { title: "Data Centers", desc: "Tier IV data centers with 24/7 security, biometric access, video surveillance, and environmental controls.", icon: Server },
                        { title: "Network Isolation", desc: "Virtual private cloud (VPC) with private subnets, security groups, and network access control lists (NACLs).", icon: Network },
                        { title: "Redundancy", desc: "Multi-region architecture with automated failover, ensuring 99.99% uptime SLA for all services.", icon: RefreshCw },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <item.icon className="w-4 h-4 text-cyan-400" />
                            <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Encryption */}
                <div id="encryption" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center"><Lock className="w-5 h-5 text-purple-400" /></div>
                    <h2 className="text-2xl font-bold">Encryption</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Lock className="w-4 h-4 text-purple-400" /> Data at Rest</h4>
                        <ul className="space-y-2">
                          {["AES-256 encryption for all stored data", "AWS KMS for key management with automatic rotation", "Encrypted database backups with separate encryption keys", "Full-disk encryption on all servers and workstations"].map((item) => (
                            <li key={item} className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-muted-foreground">{item}</span></li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Network className="w-4 h-4 text-cyan-400" /> Data in Transit</h4>
                        <ul className="space-y-2">
                          {["TLS 1.3 for all client-server communications", "Perfect Forward Secrecy (PFS) key exchange", "HSTS enforcement with preloading", "Certificate transparency monitoring"].map((item) => (
                            <li key={item} className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-muted-foreground">{item}</span></li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Access Control */}
                <div id="access-control" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center"><KeyRound className="w-5 h-5 text-blue-400" /></div>
                    <h2 className="text-2xl font-bold">Access Control</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        "Role-based access control (RBAC) with principle of least privilege",
                        "Multi-factor authentication (MFA) required for all internal systems",
                        "SSO integration via SAML 2.0 for enterprise accounts",
                        "Automated access provisioning and de-provisioning workflows",
                        "Quarterly access reviews and certification by managers",
                        "Privileged access management (PAM) for administrative operations",
                        "Session management with automatic timeout and re-authentication",
                        "IP allowlisting for sensitive administrative operations",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Monitoring */}
                <div id="monitoring" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center"><Eye className="w-5 h-5 text-emerald-400" /></div>
                    <h2 className="text-2xl font-bold">Monitoring & Threat Detection</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "SIEM Platform", desc: "Centralized security information and event management with real-time correlation of security events across all systems." },
                        { title: "Intrusion Detection", desc: "Network-based and host-based intrusion detection systems (IDS/IPS) monitoring for suspicious activity 24/7." },
                        { title: "Anomaly Detection", desc: "AI-powered behavioral analytics that detect unusual access patterns, data exfiltration attempts, and account compromise." },
                        { title: "Log Management", desc: "Comprehensive audit logging with tamper-proof storage, 90-day hot retention, and 7-year cold storage for compliance." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Network Security */}
                <div id="network" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center"><Network className="w-5 h-5 text-orange-400" /></div>
                    <h2 className="text-2xl font-bold">Network Security</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <ul className="space-y-2">
                      {[
                        "Web Application Firewall (WAF) protecting against OWASP Top 10 vulnerabilities",
                        "DDoS protection with automatic traffic scrubbing and rate limiting",
                        "DNS security with DNSSEC and DNS-over-HTTPS support",
                        "Content delivery network (CDN) with edge security controls",
                        "Network segmentation isolating production, staging, and development environments",
                        "VPN-only access to internal management interfaces",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
                          <span className="text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Application Security */}
                <div id="application" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-400/10 flex items-center justify-center"><ScanLine className="w-5 h-5 text-pink-400" /></div>
                    <h2 className="text-2xl font-bold">Application Security</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Secure SDLC", desc: "Security integrated into every phase of our software development lifecycle, from design to deployment." },
                        { title: "Code Reviews", desc: "Mandatory peer code reviews with security-focused checklists for all production changes." },
                        { title: "Dependency Scanning", desc: "Automated scanning of all third-party dependencies for known vulnerabilities using Snyk and Dependabot." },
                        { title: "SAST & DAST", desc: "Static and dynamic application security testing in our CI/CD pipeline, blocking deployments with critical findings." },
                        { title: "API Security", desc: "Rate limiting, input validation, authentication, and authorization checks on all API endpoints." },
                        { title: "CSP & Headers", desc: "Strict Content Security Policy, X-Frame-Options, X-Content-Type-Options, and other security headers enforced." },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
                          <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Security Testing */}
                <div id="testing" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center"><Bug className="w-5 h-5 text-red-400" /></div>
                    <h2 className="text-2xl font-bold">Security Testing</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { title: "Penetration Testing", desc: "Annual third-party penetration tests by CREST-certified firms covering web, mobile, and API surfaces.", frequency: "Annually" },
                        { title: "Vulnerability Scanning", desc: "Continuous automated vulnerability scanning of all infrastructure and application components.", frequency: "Daily" },
                        { title: "Red Team Exercises", desc: "Simulated attack scenarios to test detection capabilities and incident response procedures.", frequency: "Bi-annually" },
                        { title: "Security Audits", desc: "Comprehensive security audits of policies, procedures, and technical controls by independent auditors.", frequency: "Annually" },
                      ].map((item) => (
                        <div key={item.title} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">{item.frequency}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Incident Response */}
                <div id="incident-response" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-400" /></div>
                    <h2 className="text-2xl font-bold">Incident Response</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Our incident response program ensures rapid detection, containment, and resolution of security events:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { phase: "1. Detection", desc: "Automated alerts and 24/7 monitoring", time: "< 5 min" },
                        { phase: "2. Triage", desc: "Severity classification and team mobilization", time: "< 15 min" },
                        { phase: "3. Containment", desc: "Isolate threat and prevent spread", time: "< 1 hour" },
                        { phase: "4. Resolution", desc: "Root cause analysis and remediation", time: "< 24 hours" },
                      ].map((item) => (
                        <div key={item.phase} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                          <h4 className="text-xs font-semibold text-foreground mb-1">{item.phase}</h4>
                          <p className="text-[10px] text-muted-foreground mb-2">{item.desc}</p>
                          <span className="text-sm font-bold text-amber-400">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Certifications */}
                <div id="compliance" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-emerald-400" /></div>
                    <h2 className="text-2xl font-bold">Certifications & Compliance</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {certifications.map((cert) => (
                        <div key={cert.name} className={`p-4 rounded-xl ${cert.bgColor} border border-white/5`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={`text-sm font-bold ${cert.color}`}>{cert.name}</h4>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${cert.bgColor} ${cert.color} font-medium`}>{cert.status}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{cert.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Responsible Disclosure */}
                <div id="responsible-disclosure" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-400/10 flex items-center justify-center"><Fingerprint className="w-5 h-5 text-pink-400" /></div>
                    <h2 className="text-2xl font-bold">Responsible Disclosure & Bug Bounty</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      We value the security research community and welcome responsible disclosure of vulnerabilities. Our bug bounty program rewards researchers who help us keep Balencia secure.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">How to Report</h4>
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2"><ChevronRight className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-muted-foreground">Email: security@balencia.app</span></li>
                          <li className="flex items-start gap-2"><ChevronRight className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-muted-foreground">PGP key available for encrypted submissions</span></li>
                          <li className="flex items-start gap-2"><ChevronRight className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-muted-foreground">Include detailed reproduction steps</span></li>
                          <li className="flex items-start gap-2"><ChevronRight className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-muted-foreground">Allow 48 hours for initial response</span></li>
                        </ul>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Bug Bounty Rewards</h4>
                        <ul className="space-y-2">
                          <li className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Critical (RCE, SQLi, Auth Bypass)</span><span className="text-xs font-bold text-emerald-400">$1,000 - $5,000</span></li>
                          <li className="flex items-center justify-between"><span className="text-xs text-muted-foreground">High (XSS, IDOR, Data Exposure)</span><span className="text-xs font-bold text-emerald-400">$500 - $1,000</span></li>
                          <li className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Medium (CSRF, Info Disclosure)</span><span className="text-xs font-bold text-emerald-400">$100 - $500</span></li>
                          <li className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Low (Best Practices, Misconfig)</span><span className="text-xs font-bold text-emerald-400">$50 - $100</span></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div id="contact" className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Mail className="w-5 h-5 text-primary" /></div>
                    <h2 className="text-2xl font-bold">Security Contact</h2>
                  </div>
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <p className="text-muted-foreground leading-relaxed">For security-related inquiries, vulnerability reports, or compliance questions:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Security Team</h4>
                        <p className="text-xs text-muted-foreground mb-1">General: security@balencia.app</p>
                        <p className="text-xs text-muted-foreground mb-1">Vulnerabilities: security@balencia.app</p>
                        <p className="text-xs text-muted-foreground">Compliance: compliance@balencia.app</p>
                      </div>
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Response Times</h4>
                        <p className="text-xs text-muted-foreground mb-1">Vulnerability reports: 48 hours</p>
                        <p className="text-xs text-muted-foreground mb-1">General inquiries: 5 business days</p>
                        <p className="text-xs text-muted-foreground">Compliance requests: 30 days</p>
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
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-blue-500" />
                <Shield className="w-10 h-10 text-purple-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Found a Security Issue?</h3>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">We appreciate responsible disclosure and will reward valid vulnerability reports through our bug bounty program.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a href="mailto:security@balencia.app" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold hover:opacity-90 transition-opacity">
                    Report Vulnerability <ArrowRight className="w-4 h-4" />
                  </a>
                  <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl glass border border-white/10 text-foreground font-semibold hover:border-primary/30 transition-all">
                    Contact Us <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
