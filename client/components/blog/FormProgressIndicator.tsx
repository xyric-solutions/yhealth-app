"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FormProgressIndicatorProps {
  completion: number; // 0-100
  className?: string;
}

export function FormProgressIndicator({
  completion,
  className,
}: FormProgressIndicatorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Progress Bar */}
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-500 via-teal-500 to-sky-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${completion}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      </div>

      {/* Completion Percentage */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Overall Progress</span>
        <span className="font-semibold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          {Math.round(completion)}% Complete
        </span>
      </div>
    </div>
  );
}

/**
 * Calculate form completion percentage based on weighted steps
 */
export function calculateFormProgress(formData: {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  featured_image?: string | null;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  status?: string;
  category?: string;
  tags?: string[];
}): number {
  const weights = {
    title: 10,
    slug: 5,
    excerpt: 5,
    content: 40,
    featured_image: 15,
    meta_title: 8,
    meta_description: 7,
    meta_keywords: 3,
    status: 2,
    category: 2,
    tags: 3,
  };

  let totalWeight = 0;
  let completedWeight = 0;

  // Title (10%)
  totalWeight += weights.title;
  if (formData.title?.trim()) completedWeight += weights.title;

  // Slug (5%)
  totalWeight += weights.slug;
  if (formData.slug?.trim()) completedWeight += weights.slug;

  // Excerpt (5%)
  totalWeight += weights.excerpt;
  if (formData.excerpt?.trim()) completedWeight += weights.excerpt;

  // Content (40%)
  totalWeight += weights.content;
  if (formData.content && formData.content.trim().length >= 100) {
    completedWeight += weights.content;
  }

  // Featured Image (15%)
  totalWeight += weights.featured_image;
  if (formData.featured_image) completedWeight += weights.featured_image;

  // Meta Title (8%)
  totalWeight += weights.meta_title;
  if (formData.meta_title?.trim()) completedWeight += weights.meta_title;

  // Meta Description (7%)
  totalWeight += weights.meta_description;
  if (formData.meta_description?.trim()) completedWeight += weights.meta_description;

  // Meta Keywords (3%)
  totalWeight += weights.meta_keywords;
  if (formData.meta_keywords?.trim()) completedWeight += weights.meta_keywords;

  // Status (2%)
  totalWeight += weights.status;
  if (formData.status) completedWeight += weights.status;

  // Category (2%)
  totalWeight += weights.category;
  if (formData.category?.trim()) completedWeight += weights.category;

  // Tags (3%)
  totalWeight += weights.tags;
  if (formData.tags && formData.tags.length > 0) completedWeight += weights.tags;

  return Math.round((completedWeight / totalWeight) * 100);
}

