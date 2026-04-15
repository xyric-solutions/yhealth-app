"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Users,
  Search,
  MessageCircle,
  ThumbsUp,
  Eye,
  Pin,
  Star,
  ArrowRight,
  Loader2,
  HelpCircle,
  Lightbulb,
  Trophy,
  Flame,
  Megaphone,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import { api } from "@/lib/api-client";

interface CommunityPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  post_type: string;
  status: string;
  views: number;
  likes: number;
  replies_count: number;
  is_pinned: boolean;
  is_featured: boolean;
  author_first_name: string | null;
  author_last_name: string | null;
  created_at: string;
}

interface PostCategory {
  category: string;
  count: number;
}

const postTypeConfig: Record<string, { icon: typeof MessageCircle; label: string; color: string }> = {
  discussion: { icon: MessageCircle, label: "Discussion", color: "text-cyan-400" },
  question: { icon: HelpCircle, label: "Question", color: "text-amber-400" },
  tip: { icon: Lightbulb, label: "Tip", color: "text-emerald-400" },
  success_story: { icon: Trophy, label: "Success Story", color: "text-purple-400" },
  challenge: { icon: Flame, label: "Challenge", color: "text-pink-400" },
  announcement: { icon: Megaphone, label: "Announcement", color: "text-orange-400" },
};

export default function CommunityPageContent() {
  const heroRef = useRef(null);
  const postsRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const postsInView = useInView(postsRef, { once: true, margin: "-100px" });

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [, setCategories] = useState<PostCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (search) params.set("search", search);
        if (selectedType) params.set("post_type", selectedType);
        const [postsRes, catsRes] = await Promise.all([
          api.get<CommunityPost[]>(`/community?${params.toString()}`),
          api.get<PostCategory[]>("/community/categories"),
        ]);
        setPosts(postsRes.data || []);
        setCategories(catsRes.data || []);
      } catch {
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [search, selectedType]);

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <MainLayout>
      {/* HERO */}
      <section ref={heroRef} className="relative min-h-[45vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
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
                <Users className="w-4 h-4 text-primary" />
                <span className="gradient-text font-semibold">Community</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
            >
              Join the <span className="gradient-text">Conversation</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-xl mx-auto"
            >
              Connect with fellow health enthusiasts, share your journey, ask questions, and grow together.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="max-w-xl mx-auto"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search discussions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-foreground text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 backdrop-blur-sm"
                />
              </div>
            </motion.div>

            {/* Type Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-wrap justify-center gap-2"
            >
              <button
                onClick={() => setSelectedType("")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedType === "" ? "bg-primary text-white" : "glass-card hover:border-primary/30"
                }`}
              >
                All Posts
              </button>
              {Object.entries(postTypeConfig).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                    selectedType === type ? "bg-primary text-white" : "glass-card hover:border-primary/30"
                  }`}
                >
                  <config.icon className="w-3 h-3" />
                  {config.label}
                </button>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* POSTS */}
      <section ref={postsRef} className="relative py-16 overflow-hidden">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No posts found. Be the first to start a discussion!</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-3">
              {posts.map((post, index) => {
                const typeConfig = postTypeConfig[post.post_type] || postTypeConfig.discussion;
                const TypeIcon = typeConfig.icon;
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={postsInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: index * 0.03 }}
                  >
                    <Link
                      href={`/community/${post.slug}`}
                      className="glass-card p-5 rounded-2xl block group hover:border-primary/20 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 ${typeConfig.color}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {post.is_pinned && (
                              <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />
                            )}
                            {post.is_featured && (
                              <Star className="w-3 h-3 text-primary flex-shrink-0" />
                            )}
                            <span className={`text-[10px] font-medium capitalize ${typeConfig.color}`}>
                              {typeConfig.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatTimeAgo(post.created_at)}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1 line-clamp-1">
                            {post.title}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                            by {post.author_first_name || "Anonymous"}
                          </p>
                          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {post.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" />
                              {post.likes}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              {post.replies_count}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-2" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={postsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="max-w-3xl mx-auto mt-12 text-center glass-card p-8 rounded-3xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-sky-600" />
            <h3 className="text-xl font-bold mb-2">Share Your Story</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Join thousands of members sharing their health journey
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold text-sm hover:from-emerald-600 hover:to-sky-600 transition-all"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
