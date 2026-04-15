"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { sanitizeHtml } from "@/lib/sanitize";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, User, ArrowLeft, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { BlogCardProps } from "@/components/blog/BlogCard";
import { BlogReactions } from "@/components/blog/BlogReactions";

interface BlogDetailContentProps {
  blog: BlogCardProps & {
    content: string;
    markdown_content?: string | null;
  };
}

export function BlogDetailContent({ blog }: BlogDetailContentProps) {
  const authorName = `${blog.author_first_name} ${blog.author_last_name}`;
  const publishedDate = blog.published_at ? new Date(blog.published_at) : null;

  // Increment view count on mount
  useEffect(() => {
    const incrementViews = async () => {
      try {
        await api.post(`/blogs/${blog.id}/views`);
      } catch {
        // Ignore errors
      }
    };
    incrementViews();
  }, [blog.id]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: blog.title,
          text: blog.excerpt || "",
          url: window.location.href,
        });
      } catch (_err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <article className="relative min-h-screen py-12">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Button variant="ghost" asChild>
            <Link href="/blogs">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blogs
            </Link>
          </Button>
        </motion.div>

        {/* Featured Image */}
        {blog.featured_image && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full h-96 rounded-2xl overflow-hidden mb-8"
          >
            <Image
              src={blog.featured_image}
              alt={blog.title}
              fill
              className="object-cover"
              priority
            />
          </motion.div>
        )}

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h1 className="text-4xl lg:text-5xl font-bold mb-6">{blog.title}</h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-6">
            {/* Author */}
            <div className="flex items-center gap-2">
              {blog.author_avatar ? (
                <Image
                  src={blog.author_avatar}
                  alt={authorName}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span>{authorName}</span>
            </div>

            {/* Date */}
            {publishedDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDistanceToNow(publishedDate, { addSuffix: true })}</span>
              </div>
            )}

            {/* Reading Time */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{blog.reading_time} min read</span>
            </div>

            {/* Share Button */}
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </motion.header>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(blog.content) }}
            className="blog-content [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_p]:mb-4 [&_p]:leading-relaxed [&_a]:text-emerald-400 [&_a]:underline [&_a]:hover:text-sky-400 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_li]:mb-2 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4"
          />
        </motion.div>

        {/* Like / Dislike */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12 pt-6 border-t border-border/40"
        >
          <p className="text-sm text-muted-foreground mb-3">Did you find this article helpful?</p>
          <BlogReactions blogId={blog.id} />
        </motion.div>

        {/* Structured Data (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: blog.title,
              description: blog.excerpt || blog.title,
              image: blog.featured_image,
              datePublished: blog.published_at,
              author: {
                "@type": "Person",
                name: authorName,
              },
              publisher: {
                "@type": "Organization",
                name: "Balencia",
              },
            }),
          }}
        />
      </div>
    </article>
  );
}

