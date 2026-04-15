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
  MessageCircle,
  Pin,
  Star,
  Loader2,
  User,
  Send,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";

interface CommunityPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  post_type: string;
  views: number;
  likes: number;
  replies_count: number;
  is_pinned: boolean;
  is_featured: boolean;
  author_first_name: string | null;
  author_last_name: string | null;
  created_at: string;
}

interface CommunityReply {
  id: string;
  content: string;
  author_first_name: string | null;
  author_last_name: string | null;
  created_at: string;
  likes: number;
}

const postTypeConfig: Record<string, { label: string; color: string }> = {
  discussion: { label: "Discussion", color: "from-sky-500/20 to-sky-600/20 border-sky-500/30 text-sky-400" },
  question: { label: "Question", color: "from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-400" },
  tip: { label: "Tip", color: "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400" },
  success_story: { label: "Success Story", color: "from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400" },
  challenge: { label: "Challenge", color: "from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400" },
  announcement: { label: "Announcement", color: "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400" },
};

export default function CommunityPostDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { isAuthenticated } = useAuth();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const fetchPost = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<CommunityPost>(`/community/${slug}`);
        if (res.success && res.data) {
          setPost(res.data);
          setLikeCount(res.data.likes);
          // Increment view count
          api.post(`/community/${res.data.id}/views`).catch(() => {});
          // Fetch replies
          const repliesRes = await api.get<{ replies: CommunityReply[]; total: number }>(`/community/${res.data.id}/replies`);
          const replyData = repliesRes.data;
          setReplies(replyData?.replies ?? (Array.isArray(replyData) ? replyData : []));
        } else {
          throw new Error("Post not found");
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Post not found");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPost();
  }, [slug]);


  const handleLike = async () => {
    if (!post || !isAuthenticated) return;
    try {
      await api.post(`/community/${post.id}/like`);
      setIsLiked(true);
      setLikeCount((c) => c + 1);
    } catch {
      // Ignore
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !replyText.trim() || !isAuthenticated) return;
    try {
      await api.post(`/community/${post.id}/replies`, { content: replyText.trim() });
      setReplyText("");
      const repliesRes = await api.get<{ replies: CommunityReply[]; total: number }>(`/community/${post.id}/replies`);
      setReplies(repliesRes.data?.replies ?? []);
    } catch {
      // Ignore
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
            <p className="text-muted-foreground">Loading post...</p>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  if (error || !post) {
    return (
      <MainLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
        >
          <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "This post may have been removed."}</p>
          <Button asChild variant="outline">
            <Link href="/community">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Community
            </Link>
          </Button>
        </motion.div>
      </MainLayout>
    );
  }

  const typeConfig = postTypeConfig[post.post_type] || postTypeConfig.discussion;

  return (
    <MainLayout>
      <article className="relative min-h-screen py-12">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="absolute bottom-0 left-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl"
          />
          <div className="absolute inset-0 cyber-grid opacity-5" />
        </div>

        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <Button variant="ghost" asChild className="group">
              <Link href="/community" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Community
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-card rounded-2xl overflow-hidden border border-white/10"
          >
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-sky-600" />

            <div className="p-6 md:p-10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {post.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                    <Pin className="w-3 h-3" /> Pinned
                  </span>
                )}
                {post.is_featured && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                    <Star className="w-3 h-3" /> Featured
                  </span>
                )}
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r border ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl md:text-4xl font-bold mb-6"
              >
                {post.title}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-8"
              >
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {post.author_first_name || "Anonymous"} {post.author_last_name || ""}
                </span>
                <span>{formatTimeAgo(post.created_at)}</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4 text-emerald-500/70" />
                  {post.views} views
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
                className="prose prose-invert max-w-none [&_p]:mb-4 [&_p]:leading-relaxed [&_a]:text-emerald-400 [&_a]:hover:text-sky-400 [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6"
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 pt-6 border-t border-white/10 flex items-center gap-4"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLike}
                  disabled={!isAuthenticated || isLiked}
                  className={`gap-2 ${isLiked ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/20 hover:border-emerald-500/30"}`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  {likeCount} {isLiked ? "Liked" : "Like"}
                </Button>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MessageCircle className="w-4 h-4" />
                  {post.replies_count} replies
                </span>
              </motion.div>
            </div>
          </motion.div>

          {/* Replies */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-12"
          >
            <h2 className="text-xl font-bold mb-6">Replies ({replies.length})</h2>

            {isAuthenticated && (
              <form onSubmit={handleReply} className="mb-8">
                <div className="flex gap-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 min-h-[80px] px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 resize-none"
                    required
                  />
                  <Button type="submit" disabled={!replyText.trim()} className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}

            {!isAuthenticated && (
              <p className="text-sm text-muted-foreground mb-6">
                <Link href="/auth/signin" className="text-emerald-400 hover:underline">Sign in</Link> to join the conversation.
              </p>
            )}

            <div className="space-y-4">
              <AnimatePresence>
                {replies.map((reply, i) => (
                  <motion.div
                    key={reply.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-4 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {reply.author_first_name || "Anonymous"} {reply.author_last_name || ""}
                      </span>
                      <span>·</span>
                      <span>{formatTimeAgo(reply.created_at)}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{reply.content}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        </div>
      </article>
    </MainLayout>
  );
}
