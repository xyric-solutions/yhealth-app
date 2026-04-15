"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  HelpCircle,
  Search,
  BookOpen,
  MessageCircle,

  ThumbsUp,

  Eye,
  ChevronRight,
  Loader2,
  Mail,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import { api } from "@/lib/api-client";

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  views: number;
  helpful_yes: number;
  helpful_no: number;
}

interface HelpCategory {
  category: string;
  count: number;
}

const faqItems = [
  {
    question: "How does Balencia track my fitness progress?",
    answer:
      "Balencia uses AI to analyze your workout data, activity levels, and health metrics from connected devices to provide personalized insights and track your progress over time.",
  },
  {
    question: "Can I connect my wearable device?",
    answer:
      "Yes! Balencia integrates with popular wearables including WHOOP, Apple Watch, Fitbit, and Garmin. Connect your device in Settings > Integrations.",
  },
  {
    question: "How does the AI health coach work?",
    answer:
      "Our AI coach uses your health data, goals, and preferences to provide personalized recommendations for fitness, nutrition, and mental wellbeing through natural conversations.",
  },
  {
    question: "Is my health data secure?",
    answer:
      "Absolutely. We use end-to-end encryption and follow HIPAA-compliant practices. Your data is never sold to third parties. Read our Privacy Policy for full details.",
  },
  {
    question: "How do I cancel my subscription?",
    answer:
      "You can cancel anytime from Settings > Subscription > Manage Plan. Your access continues until the end of your billing period.",
  },
];

const categoryIcons: Record<string, string> = {
  general: "text-cyan-400",
  "getting-started": "text-emerald-400",
  account: "text-purple-400",
  fitness: "text-pink-400",
  nutrition: "text-amber-400",
  billing: "text-orange-400",
  integrations: "text-blue-400",
  troubleshooting: "text-red-400",
};

export default function HelpPageContent() {
  const heroRef = useRef(null);
  const articlesRef = useRef(null);
  const faqRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const articlesInView = useInView(articlesRef, { once: true, margin: "-100px" });
  const faqInView = useInView(faqRef, { once: true, margin: "-100px" });

  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: "12" });
        if (search) params.set("search", search);
        if (selectedCategory) params.set("category", selectedCategory);
        const [articlesRes, categoriesRes] = await Promise.all([
          api.get<HelpArticle[]>(`/help?${params.toString()}`),
          api.get<HelpCategory[]>("/help/categories"),
        ]);
        setArticles(articlesRes.data || []);
        setCategories(categoriesRes.data || []);
      } catch {
        setArticles([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [search, selectedCategory]);

  return (
    <MainLayout>
      {/* HERO */}
      <section ref={heroRef} className="relative min-h-[50vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 cyber-grid opacity-5" />
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium">
                <HelpCircle className="w-4 h-4 text-primary" />
                <span className="gradient-text font-semibold">Help Center</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
            >
              How Can We <span className="gradient-text">Help?</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-xl mx-auto"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search help articles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-foreground text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 backdrop-blur-sm"
                />
              </div>
            </motion.div>

            {/* Category Pills */}
            {categories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-wrap justify-center gap-2"
              >
                <button
                  onClick={() => setSelectedCategory("")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === ""
                      ? "bg-primary text-white"
                      : "glass-card hover:border-primary/30"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() => setSelectedCategory(cat.category)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                      selectedCategory === cat.category
                        ? "bg-primary text-white"
                        : "glass-card hover:border-primary/30"
                    }`}
                  >
                    {cat.category.replace(/-/g, " ")} ({cat.count})
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ARTICLES */}
      <section ref={articlesRef} className="relative py-16 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={articlesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Popular <span className="gradient-text">Articles</span>
            </h2>
          </motion.div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No articles found. Try a different search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {articles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={articlesInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Link
                    href={`/help/${article.slug}`}
                    className="glass-card p-5 rounded-2xl block group hover:border-emerald-500/30 transition-all duration-300 h-full overflow-hidden relative"
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                          article.category === "getting-started"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-white/5 border border-white/10 " + (categoryIcons[article.category] || "text-muted-foreground")
                        }`}
                      >
                        {article.category.replace(/-/g, " ")}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                    <h3 className="text-sm font-semibold text-sky-300 group-hover:text-sky-200 transition-colors mb-2 line-clamp-2">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {article.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        {article.helpful_yes}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section ref={faqRef} className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={faqInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Frequently Asked <span className="gradient-text">Questions</span>
            </h2>
          </motion.div>

          <div className="max-w-2xl mx-auto space-y-3">
            {faqItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                animate={faqInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="glass-card rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-sm font-semibold text-foreground pr-4">
                    {item.question}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
                      expandedFaq === index ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {expandedFaq === index && (
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={faqInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="max-w-3xl mx-auto mt-12 text-center glass-card p-8 rounded-3xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-sky-600" />
            <h3 className="text-xl font-bold mb-2">Still Need Help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our support team is here to assist you with any questions
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold text-sm hover:from-emerald-600 hover:to-sky-600 transition-all"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </Link>
              <Link
                href="/community"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl glass border border-white/10 text-foreground font-semibold text-sm hover:border-primary/30 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Ask the Community
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
