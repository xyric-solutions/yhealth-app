"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, User, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export interface BlogCardProps {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  author_first_name: string;
  author_last_name: string;
  author_avatar: string | null;
  published_at: Date | string | null;
  reading_time: number;
  className?: string;
}

export function BlogCard({
  title,
  slug,
  excerpt,
  featured_image,
  author_first_name,
  author_last_name,
  author_avatar,
  published_at,
  reading_time,
  className,
}: BlogCardProps) {
  const authorName = `${author_first_name} ${author_last_name}`;
  const publishedDate = published_at ? new Date(published_at) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className={cn("group glass-card rounded-2xl overflow-hidden", className)}
    >
      <Link href={`/blogs/${slug}`} className="block">
        {/* Featured Image */}
        {featured_image && (
          <div className="relative w-full h-48 overflow-hidden">
            <Image
              src={featured_image}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h3 className="text-xl font-bold mb-3 line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>

          {/* Excerpt */}
          {excerpt && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {excerpt}
            </p>
          )}

          {/* Meta Information */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              {/* Author */}
              <div className="flex items-center gap-2">
                {author_avatar ? (
                  <Image
                    src={author_avatar}
                    alt={authorName}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span>{authorName}</span>
              </div>

              {/* Date */}
              {publishedDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {formatDistanceToNow(publishedDate, { addSuffix: true })}
                  </span>
                </div>
              )}

              {/* Reading Time */}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{reading_time} min read</span>
              </div>
            </div>

            {/* Read More */}
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

