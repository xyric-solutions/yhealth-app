"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitize";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Loader2,
  BookOpen,
  Mail,
  MessageCircle,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  views: number;
  helpful_yes: number;
  helpful_no: number;
  author_first_name: string | null;
  author_last_name: string | null;
  published_at: string | null;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  general: "from-sky-500/20 to-sky-600/20 border-sky-500/30 text-sky-400",
  "getting-started": "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400",
  account: "from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400",
  fitness: "from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400",
  nutrition: "from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-400",
  billing: "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400",
  integrations: "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400",
  troubleshooting: "from-red-500/20 to-red-600/20 border-red-500/30 text-red-400",
};

export default function HelpArticleDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    if (!slug) return;
    const fetchArticle = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<HelpArticle>(`/help/${slug}`);
        if (res.success && res.data) {
          setArticle(res.data);
          // Increment view count
          api.post(`/help/${res.data.id}/views`).catch(() => {});
        } else {
          throw new Error("Article not found");
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Article not found");
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticle();
  }, [slug]);

  const handleFeedback = async (helpful: boolean) => {
    if (!article || feedbackSent) return;
    try {
      await api.post(`/help/${article.id}/feedback`, { helpful });
      setFeedbackSent(helpful ? "yes" : "no");
    } catch {
      // Ignore
    }
  };

  const handleShare = async () => {
    if (navigator.share && article) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt || article.title,
          url: window.location.href,
        });
      } catch {
        navigator.clipboard.writeText(window.location.href);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
            <p className="text-muted-foreground">Loading article...</p>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  if (error || !article) {
    return (
      <MainLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
        >
          <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "This article may have been removed."}</p>
          <Button asChild variant="outline">
            <Link href="/help">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Help Center
            </Link>
          </Button>
        </motion.div>
      </MainLayout>
    );
  }

  const categoryStyle = categoryColors[article.category] || categoryColors.general;

  return (
    <MainLayout>
      <article className="relative min-h-screen py-12">
        {/* Animated gradient background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="absolute bottom-0 right-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl"
          />
          <div className="absolute inset-0 cyber-grid opacity-5" />
        </div>

        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <Button variant="ghost" asChild className="group">
              <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Help Center
              </Link>
            </Button>
          </motion.div>

          {/* Article card with frosted glass */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-card rounded-2xl overflow-hidden border border-white/10"
          >
            {/* Gradient accent bar */}
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-sky-600" />

            <div className="p-6 md:p-10">
              {/* Category badge */}
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize bg-gradient-to-r border ${categoryStyle} mb-4`}
              >
                {article.category.replace(/-/g, " ")}
              </motion.span>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent"
              >
                {article.title}
              </motion.h1>

              {/* Meta row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-8"
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-500/70" />
                  {article.views} views
                </span>
                {article.author_first_name && (
                  <span>
                    by {article.author_first_name} {article.author_last_name || ""}
                  </span>
                )}
                {article.published_at && (
                  <span>{new Date(article.published_at).toLocaleDateString("en-US", { dateStyle: "long" })}</span>
                )}
                <Button variant="ghost" size="sm" onClick={handleShare} className="hover:text-emerald-400">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </motion.div>

              {/* Content */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
                className="help-article-content prose prose-invert max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-4 [&_p]:leading-relaxed [&_a]:text-emerald-400 [&_a]:hover:text-sky-400 [&_a]:underline [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_li]:mb-2 [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-slate-900/80 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4"
              />

              {/* Feedback section */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-10 pt-8 border-t border-white/10"
              >
                <p className="text-sm font-medium text-foreground mb-3">Was this article helpful?</p>
                <div className="flex items-center gap-3">
                  <AnimatePresence mode="wait">
                    {feedbackSent ? (
                      <motion.p
                        key="thanks"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm text-emerald-400"
                      >
                        Thanks for your feedback!
                      </motion.p>
                    ) : (
                      <motion.div key="buttons" className="flex gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeedback(true)}
                          className="gap-2 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Yes ({article.helpful_yes})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeedback(false)}
                          className="gap-2 border-white/20 hover:bg-white/5"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          No ({article.helpful_no})
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* CTA card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-12 glass-card p-8 rounded-2xl border border-white/10 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-sky-600" />
            <h3 className="text-xl font-bold mb-2">Still Need Help?</h3>
            <p className="text-muted-foreground text-sm mb-4">Our support team is here to assist you with any questions.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white">
                <Link href="/contact" className="gap-2">
                  <Mail className="w-4 h-4" />
                  Contact Support
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20">
                <Link href="/community" className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Ask the Community
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </article>
    </MainLayout>
  );
}
