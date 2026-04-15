"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import Link from "next/link";

interface BlogReactionsProps {
  blogId: string;
  className?: string;
}

interface ReactionsData {
  likes: number;
  dislikes: number;
  userReaction: "like" | "dislike" | null;
}

export function BlogReactions({ blogId, className }: BlogReactionsProps) {
  const { isAuthenticated } = useAuth();
  const [reactions, setReactions] = useState<ReactionsData>({
    likes: 0,
    dislikes: 0,
    userReaction: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchReactions = useCallback(async () => {
    try {
      const response = await api.get<ReactionsData>(
        `/blogs/${blogId}/reactions`
      );
      if (response.success && response.data) {
        setReactions(response.data);
      }
    } catch {
      // Silently fail - reactions are non-critical
    }
  }, [blogId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  const handleReaction = async (type: "like" | "dislike") => {
    if (!isAuthenticated) {
      toast("Please sign in to react to this blog", { icon: "🔒" });
      return;
    }

    if (isLoading) return;

    // Optimistic update
    const prevReactions = { ...reactions };
    setReactions((prev) => {
      const newReactions = { ...prev };

      if (prev.userReaction === type) {
        // Toggle off
        newReactions[type === "like" ? "likes" : "dislikes"] -= 1;
        newReactions.userReaction = null;
      } else {
        // Remove previous reaction if exists
        if (prev.userReaction) {
          newReactions[prev.userReaction === "like" ? "likes" : "dislikes"] -= 1;
        }
        // Add new reaction
        newReactions[type === "like" ? "likes" : "dislikes"] += 1;
        newReactions.userReaction = type;
      }

      return newReactions;
    });

    setIsLoading(true);
    try {
      const response = await api.post<{
        action: string;
        type: string;
        reactions: ReactionsData;
      }>(`/blogs/${blogId}/reactions`, { type });

      if (response.success && response.data) {
        // Sync with server state
        setReactions(response.data.reactions);
      }
    } catch (err) {
      // Revert optimistic update
      setReactions(prevReactions);
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update reaction"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Like Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => handleReaction("like")}
        className={cn(
          "group flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200",
          reactions.userReaction === "like"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800/60 hover:text-emerald-400 hover:border-emerald-500/20"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={reactions.userReaction === "like" ? "filled" : "outline"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ThumbsUp
              className={cn(
                "w-5 h-5 transition-colors",
                reactions.userReaction === "like"
                  ? "fill-emerald-400 text-emerald-400"
                  : "group-hover:text-emerald-400"
              )}
            />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.span
            key={reactions.likes}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-sm font-semibold min-w-[1ch] tabular-nums"
          >
            {reactions.likes}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* Dislike Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => handleReaction("dislike")}
        className={cn(
          "group flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200",
          reactions.userReaction === "dislike"
            ? "bg-red-500/10 border-red-500/30 text-red-400"
            : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800/60 hover:text-red-400 hover:border-red-500/20"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={reactions.userReaction === "dislike" ? "filled" : "outline"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ThumbsDown
              className={cn(
                "w-5 h-5 transition-colors",
                reactions.userReaction === "dislike"
                  ? "fill-red-400 text-red-400"
                  : "group-hover:text-red-400"
              )}
            />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.span
            key={reactions.dislikes}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-sm font-semibold min-w-[1ch] tabular-nums"
          >
            {reactions.dislikes}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* Sign-in prompt for unauthenticated users */}
      {!isAuthenticated && (
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-xs text-slate-500 hover:text-slate-300 ml-1"
        >
          <Link href="/auth/signin">
            <LogIn className="w-3.5 h-3.5 mr-1.5" />
            Sign in to react
          </Link>
        </Button>
      )}
    </div>
  );
}
