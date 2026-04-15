"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Clock,
  MessageSquare,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
  Activity,
  Heart,
  Brain,
  Globe,
  Headphones,
  Shield,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import { api, ApiError } from "@/lib/api-client";

const pillars = [
  { icon: Activity, label: "Fitness", color: "text-cyan-400", bgColor: "bg-cyan-400/10", borderColor: "border-cyan-400/20" },
  { icon: Heart, label: "Nutrition", color: "text-purple-400", bgColor: "bg-purple-400/10", borderColor: "border-purple-400/20" },
  { icon: Brain, label: "Wellbeing", color: "text-pink-400", bgColor: "bg-pink-400/10", borderColor: "border-pink-400/20" },
];

const contactInfo = [
  {
    icon: Mail,
    label: "Email Us",
    value: "support@balencia.ai",
    description: "We respond within 24 hours",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Phone,
    label: "Call Us",
    value: "+1 (555) 123-4567",
    description: "Mon-Fri, 9am-6pm EST",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  {
    icon: MapPin,
    label: "Visit Us",
    value: "San Francisco, CA",
    description: "123 Health Innovation Blvd",
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
  },
  {
    icon: Clock,
    label: "Business Hours",
    value: "Mon - Fri, 9AM - 6PM",
    description: "EST Timezone",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
  },
];

const supportCategories = [
  { icon: Headphones, label: "Technical Support", description: "App issues & troubleshooting" },
  { icon: MessageSquare, label: "General Inquiry", description: "Questions about our services" },
  { icon: Globe, label: "Partnership", description: "Business & collaboration" },
  { icon: Shield, label: "Privacy & Security", description: "Data protection concerns" },
];

const subjectOptions = [
  "General Inquiry",
  "Technical Support",
  "Partnership Opportunity",
  "Feature Request",
  "Bug Report",
  "Billing Question",
  "Privacy & Security",
  "Other",
];

export default function ContactPageContent() {
  const heroRef = useRef(null);
  const formRef = useRef(null);
  const ctaRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const formInView = useInView(formRef, { once: true, margin: "-100px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email address";
    if (!formData.subject) newErrors.subject = "Please select a subject";
    if (!formData.message.trim()) newErrors.message = "Message is required";
    else if (formData.message.trim().length < 10)
      newErrors.message = "Message must be at least 10 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await api.post("/contact", {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        subject: formData.subject,
        message: formData.message.trim(),
      });
      if (response.success) {
        setIsSubmitted(true);
        setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ form: err.message });
      } else {
        setErrors({ form: "Failed to send message. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  return (
    <MainLayout>
      {/* ============================================ */}
      {/* HERO SECTION */}
      {/* ============================================ */}
      <section ref={heroRef} className="relative min-h-[60vh] flex items-center overflow-hidden pt-20 bg-aurora">
        {/* Background Effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-pink-500/8 rounded-full blur-3xl" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
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
                <div className="w-2 h-2 rounded-full bg-primary status-online" />
                <span className="gradient-text font-semibold">Get in Touch</span>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            </motion.div>

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                We&apos;d Love to
                <span className="block gradient-text-animated">Hear From You</span>
              </h1>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Have questions about our AI-powered health platform? Want to explore partnership
                opportunities? Our team is here to help you on your health journey.
              </p>
            </motion.div>

            {/* Three Pillars */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex justify-center gap-4 sm:gap-6 flex-wrap"
            >
              {pillars.map((pillar, index) => (
                <motion.div
                  key={pillar.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={heroInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${pillar.bgColor} border ${pillar.borderColor}`}
                >
                  <pillar.icon className={`w-4 h-4 ${pillar.color}`} />
                  <span className={`text-sm font-medium ${pillar.color}`}>{pillar.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Contact Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
              {contactInfo.map((info, index) => (
                <motion.div
                  key={info.label}
                  initial={{ opacity: 0, y: 30 }}
                  animate={heroInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="glass-card p-5 rounded-2xl text-center group cursor-default"
                >
                  <div className={`w-12 h-12 rounded-xl ${info.bgColor} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <info.icon className={`w-6 h-6 ${info.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{info.label}</h3>
                  <p className={`text-sm font-medium ${info.color}`}>{info.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SUPPORT CATEGORIES */}
      {/* ============================================ */}
      <section className="relative py-16 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              How Can We <span className="gradient-text">Help?</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Choose a category that best describes your inquiry
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {supportCategories.map((cat, index) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setFormData((prev) => ({ ...prev, subject: cat.label }));
                  document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="glass-card p-5 rounded-2xl cursor-pointer group hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                  <cat.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{cat.label}</h3>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* CONTACT FORM + MAP SECTION */}
      {/* ============================================ */}
      <section ref={formRef} id="contact-form" className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-8xl mx-auto">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={formInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="glass-card p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Send className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Send a Message</h2>
                    <p className="text-sm text-muted-foreground">Fill out the form and we&apos;ll get back to you</p>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {isSubmitted ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="text-center py-16 space-y-4"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                      >
                        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                        </div>
                      </motion.div>
                      <motion.h3
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-2xl font-bold"
                      >
                        Message Sent!
                      </motion.h3>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-muted-foreground max-w-sm mx-auto"
                      >
                        Thank you for reaching out. Our team will review your message and get back to
                        you within 24 hours.
                      </motion.p>
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        onClick={() => setIsSubmitted(false)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium text-sm"
                      >
                        Send Another Message
                        <ArrowRight className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="space-y-5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Full Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="John Doe"
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                              errors.name ? "border-red-400/50" : "border-white/10"
                            } text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all`}
                          />
                          {errors.name && (
                            <p className="text-xs text-red-400 mt-1">{errors.name}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Email Address <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="john@example.com"
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                              errors.email ? "border-red-400/50" : "border-white/10"
                            } text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all`}
                          />
                          {errors.email && (
                            <p className="text-xs text-red-400 mt-1">{errors.email}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Phone Number <span className="text-muted-foreground text-xs">(optional)</span>
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+1 (555) 000-0000"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Subject <span className="text-red-400">*</span>
                          </label>
                          <select
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                              errors.subject ? "border-red-400/50" : "border-white/10"
                            } text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer`}
                          >
                            <option value="" className="bg-slate-900 text-muted-foreground">
                              Select a subject
                            </option>
                            {subjectOptions.map((opt) => (
                              <option key={opt} value={opt} className="bg-slate-900">
                                {opt}
                              </option>
                            ))}
                          </select>
                          {errors.subject && (
                            <p className="text-xs text-red-400 mt-1">{errors.subject}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Message <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          rows={5}
                          maxLength={1000}
                          placeholder="Tell us how we can help you..."
                          className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                            errors.message ? "border-red-400/50" : "border-white/10"
                          } text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none`}
                        />
                        {errors.message && (
                          <p className="text-xs text-red-400 mt-1">{errors.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          {formData.message.length}/1000
                        </p>
                      </div>

                      {errors.form && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          {errors.form}
                        </div>
                      )}

                      <motion.button
                        type="submit"
                        disabled={isSubmitting}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-cyan"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Send Message
                          </>
                        )}
                      </motion.button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Map + Quick Info */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={formInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              className="space-y-6"
            >
              {/* Google Map */}
              <div className="glass-card rounded-3xl overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-primary" />
                <div className="p-4 pb-0">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-400/10 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Our Location</h3>
                      <p className="text-sm text-muted-foreground">Find us on the map</p>
                    </div>
                  </div>
                </div>
                <div className="relative" style={{ height: 460 }}>
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d100939.98555098464!2d-122.50764017948551!3d37.75780949657449!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80859a6d00690021%3A0x4a501367f076adff!2sSan%20Francisco%2C%20CA!5e0!3m2!1sen!2sus!4v1707000000000!5m2!1sen!2sus"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full h-full"
                    title="Balencia Office Location"
                  />
                </div>
              </div>

              {/* Quick Response Promise */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={formInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="glass-card p-6 rounded-2xl"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-1">Quick Response Guarantee</h3>
                    <p className="text-sm text-muted-foreground">
                      Our dedicated support team responds to all inquiries within 24 hours during
                      business days. For urgent matters, call us directly.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* FAQ CTA SECTION */}
      {/* ============================================ */}
      <section ref={ctaRef} className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
        </div>

        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center glass-card p-10 rounded-3xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

            <motion.div
              initial={{ scale: 0 }}
              animate={ctaInView ? { scale: 1 } : {}}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Looking for <span className="gradient-text">Quick Answers?</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Check out our comprehensive FAQ section for instant answers to the most
              commonly asked questions about Balencia.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href="/#faq"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold hover:from-primary/90 hover:to-purple-500/90 transition-all glow-cyan"
              >
                View FAQ
                <ArrowRight className="w-5 h-5" />
              </motion.a>
              <motion.a
                href="/blogs"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl glass border border-white/10 text-foreground font-semibold hover:border-primary/30 transition-all"
              >
                Read Our Blog
                <ArrowRight className="w-5 h-5" />
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
