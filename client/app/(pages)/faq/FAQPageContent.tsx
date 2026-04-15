"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  HelpCircle,
  MessageCircle,
  Sparkles,
  Search,
  X,
  Shield,
  Zap,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Data ────────────────────────────────────────────────────────────

const faqs = [
  {
    question: "Is my health data secure?",
    answer:
      "Your data is protected by AES-256 encryption at rest and TLS 1.3 in transit. We maintain full HIPAA compliance with regular third-party audits. Your data is never sold or shared — you retain complete ownership and can export or delete it at any time.",
    category: "Security",
    icon: Shield,
  },
  {
    question: "Does it replace a doctor?",
    answer:
      "No. Balencia is a wellness companion that complements professional medical care. Our AI provides personalized fitness, nutrition, and wellbeing guidance — but does not diagnose, treat, or prescribe. Always consult your healthcare provider for medical decisions.",
    category: "Trust",
    icon: HelpCircle,
  },
  {
    question: "Which wearables are supported?",
    answer:
      "We integrate with Apple Watch, Whoop, Garmin, Fitbit, Samsung Galaxy Watch, and Huawei Health. We also sync with Apple Health, Google Health Connect, and Strava — consolidating all metrics into one dashboard. New integrations are added regularly.",
    category: "Integrations",
    icon: Zap,
  },
  {
    question: "How accurate is AI coaching?",
    answer:
      "Our AI is built on evidence-based fitness, nutrition, and behavioral science research. It analyzes your biometric data, activity patterns, and sleep quality to deliver recommendations that improve over time. The system cross-references wearable data with progress trends to adjust plans dynamically.",
    category: "AI & Technology",
    icon: Sparkles,
  },
  {
    question: "What is your refund policy?",
    answer:
      "Cancel within the first 30 days for a full refund, no questions asked. After that, you keep access through the end of your billing period. No hidden fees, no penalties — reactivate anytime.",
    category: "Pricing",
    icon: Shield,
  },
  {
    question: "How does AI-powered health tracking work?",
    answer:
      "Balencia aggregates data from wearables, manual inputs, and in-app activity across Fitness, Nutrition, and Wellbeing. Our AI processes this in real time — analyzing sleep, HRV, workouts, nutrition, and stress to generate your daily Wellness Score and surface proactive insights.",
    category: "AI & Technology",
    icon: Sparkles,
  },
  {
    question: "Can I talk to my AI coach or call them?",
    answer:
      "Yes — use text chat for quick check-ins, voice commands during workouts, or the Call Coach feature for in-depth conversations. Your coach also sends proactive nudges like hydration reminders and recovery suggestions.",
    category: "AI & Technology",
    icon: MessageCircle,
  },
  {
    question: "Is there a community or way to compete?",
    answer:
      "Compete on global and friends-only leaderboards, join weekly challenges, and earn achievement badges. Prefer privacy? Keep your profile private and focus on personal goals. The community is designed to keep you engaged on your terms.",
    category: "Trust",
    icon: HelpCircle,
  },
];

const categories = [
  "All",
  ...Array.from(new Set(faqs.map((f) => f.category))),
];

const categoryGradients: Record<string, string> = {
  Security: "from-emerald-400 to-teal-500",
  Trust: "from-blue-400 to-indigo-500",
  Integrations: "from-orange-400 to-amber-500",
  "AI & Technology": "from-purple-400 to-violet-500",
  Pricing: "from-pink-400 to-rose-500",
};

const categoryGlows: Record<string, string> = {
  Security: "rgba(52, 211, 153, 0.2)",
  Trust: "rgba(96, 165, 250, 0.2)",
  Integrations: "rgba(251, 146, 60, 0.2)",
  "AI & Technology": "rgba(167, 139, 250, 0.2)",
  Pricing: "rgba(244, 114, 182, 0.2)",
};

// ─── FAQ Item Component ─────────────────────────────────────────────
function FAQItem({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: (typeof faqs)[0];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const gradient =
    categoryGradients[faq.category] || "from-primary to-purple-500";
  const glowColor = categoryGlows[faq.category] || "rgba(139, 92, 246, 0.2)";
  const Icon = faq.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="group"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border transition-all duration-500",
          isOpen
            ? "border-white/15 bg-white/[0.03] shadow-lg"
            : "border-white/[0.08] bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.025]"
        )}
        style={
          isOpen
            ? {
                boxShadow: `0 0 40px -10px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.08)`,
              }
            : undefined
        }
      >
        {/* Gradient top border */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r transition-opacity duration-500",
            gradient,
            isOpen ? "opacity-80" : "opacity-0 group-hover:opacity-40"
          )}
        />

        {/* Corner glow when open */}
        {isOpen && (
          <div
            className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[60px] pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${glowColor}, transparent 70%)`,
            }}
          />
        )}

        <button
          onClick={onToggle}
          className="w-full text-left p-5 sm:p-6 flex items-center gap-4 relative z-10"
        >
          {/* Icon */}
          <div
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
              isOpen
                ? `bg-gradient-to-br ${gradient} shadow-lg`
                : "bg-white/[0.06] group-hover:bg-white/[0.1]"
            )}
          >
            <Icon
              className={cn(
                "w-4.5 h-4.5 transition-colors duration-300",
                isOpen ? "text-white" : "text-muted-foreground/70"
              )}
              strokeWidth={2}
            />
          </div>

          {/* Question */}
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "text-[15px] sm:text-base font-semibold transition-colors duration-300 leading-snug",
                isOpen ? "text-foreground" : "text-foreground/80"
              )}
            >
              {faq.question}
            </h3>
          </div>

          {/* Category badge + Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className={cn(
                "hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-300",
                isOpen
                  ? `bg-gradient-to-r ${gradient} text-white`
                  : "bg-white/[0.06] text-muted-foreground/50"
              )}
            >
              {faq.category}
            </span>
            <motion.div
              animate={{ rotate: isOpen ? 45 : 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300",
                isOpen
                  ? "bg-white/10 text-foreground"
                  : "bg-white/[0.04] text-muted-foreground/50 group-hover:bg-white/[0.08] group-hover:text-muted-foreground"
              )}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            </motion.div>
          </div>
        </button>

        {/* Answer */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.25 },
              }}
              className="overflow-hidden"
            >
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0">
                <div className="pl-14">
                  <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent mb-4" />
                  <p className="text-sm text-muted-foreground/80 leading-[1.7]">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── FAQ PAGE CONTENT ───────────────────────────────────────────────
export default function FAQPageContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesCategory =
        activeCategory === "All" || faq.category === activeCategory;
      const matchesSearch =
        searchQuery === "" ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setOpenIndex(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-[5%] w-80 h-80 bg-purple-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-[10%] w-72 h-72 bg-primary/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-12 md:py-20">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-4xl mx-auto mb-12 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm font-medium text-primary mb-6">
            <HelpCircle className="w-3.5 h-3.5" />
            Frequently Asked Questions
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 tracking-tight leading-[1.1]">
            Everything you need{" "}
            <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
              to know.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Transparent answers about security, AI coaching, integrations, and
            pricing. Can&apos;t find what you need? Our team responds within
            hours.
          </p>
        </motion.div>

        {/* Search + Filters */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-3xl mx-auto mb-10 space-y-4"
        >
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOpenIndex(null);
              }}
              className="w-full pl-11 pr-10 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/15 transition-all backdrop-blur-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <motion.button
                key={category}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCategoryChange(category)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border",
                  activeCategory === category
                    ? "bg-primary/15 border-primary/30 text-primary shadow-sm shadow-primary/10"
                    : "bg-white/[0.03] border-white/[0.08] text-muted-foreground/60 hover:border-white/15 hover:text-foreground/80"
                )}
              >
                {category}
                {category !== "All" && (
                  <span className="ml-1.5 text-[10px] opacity-50">
                    {faqs.filter((f) => f.category === category).length}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* FAQ List */}
        <div className="max-w-3xl mx-auto">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, index) => (
                  <FAQItem
                    key={faq.question}
                    faq={faq}
                    index={index}
                    isOpen={openIndex === index}
                    onToggle={() =>
                      setOpenIndex(openIndex === index ? null : index)
                    }
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                    <Search className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground/60 text-sm mb-2">
                    No questions match your search.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("All");
                    }}
                    className="text-primary text-xs font-medium hover:underline inline-flex items-center gap-1"
                  >
                    Clear filters
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-16 md:mt-20 max-w-2xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.015] backdrop-blur-sm p-8 sm:p-10 text-center">
            {/* Gradient top border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-purple-400 to-pink-400 opacity-50" />

            {/* Corner glows */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/[0.06] rounded-full blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-500/[0.06] rounded-full blur-[80px]" />

            <div className="relative z-10">
              <div className="relative w-14 h-14 mx-auto mb-5">
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 0.15, 0.4],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/30">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 text-foreground/95">
                Still have questions?
              </h3>
              <p className="text-sm text-muted-foreground/70 mb-6 max-w-md mx-auto leading-relaxed">
                Our support team responds within hours and is available around
                the clock to assist you.
              </p>
              <Button
                size="lg"
                className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 rounded-full px-8 shadow-lg shadow-primary/20"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
