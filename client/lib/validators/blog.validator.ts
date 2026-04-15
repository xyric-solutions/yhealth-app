import { z } from "zod";

/**
 * Blog validation schemas using Zod
 * Used for both client-side and server-side validation
 */

// URL-friendly slug validation
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogTitleSchema = z
  .string()
  .min(3, "Title must be at least 3 characters")
  .max(255, "Title must not exceed 255 characters")
  .trim();

export const blogSlugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(255, "Slug must not exceed 255 characters")
  .regex(slugRegex, "Slug must be URL-friendly (lowercase letters, numbers, and hyphens only)")
  .trim();

export const blogExcerptSchema = z
  .string()
  .max(500, "Excerpt must not exceed 500 characters")
  .optional()
  .nullable();

export const blogContentSchema = z
  .string()
  .min(100, "Content must be at least 100 characters")
  .trim();

export const blogFeaturedImageSchema = z
  .string()
  .url("Featured image must be a valid URL")
  .max(500, "Image URL must not exceed 500 characters")
  .optional()
  .nullable();

export const blogMetaTitleSchema = z
  .string()
  .max(60, "Meta title should not exceed 60 characters for optimal SEO")
  .optional()
  .nullable();

export const blogMetaDescriptionSchema = z
  .string()
  .max(160, "Meta description should not exceed 160 characters for optimal SEO")
  .optional()
  .nullable();

export const blogMetaKeywordsSchema = z
  .string()
  .max(500, "Meta keywords must not exceed 500 characters")
  .optional()
  .nullable();

export const blogStatusSchema = z.enum(["draft", "published", "archived"]);

export const blogPublishedDateSchema = z
  .date()
  .refine((date) => date <= new Date(), {
    message: "Published date cannot be in the future",
  })
  .optional()
  .nullable();

export const blogCategorySchema = z
  .string()
  .max(100, "Category must not exceed 100 characters")
  .optional()
  .nullable();

export const blogTagsSchema = z
  .array(z.string().max(50, "Each tag must not exceed 50 characters"))
  .max(10, "Maximum 10 tags allowed")
  .optional()
  .default([]);

// Complete blog form schema
export const createBlogSchema = z.object({
  title: blogTitleSchema,
  slug: blogSlugSchema,
  excerpt: blogExcerptSchema,
  content: blogContentSchema,
  markdown_content: z.string().optional().nullable(),
  featured_image: blogFeaturedImageSchema,
  status: blogStatusSchema.default("draft"),
  published_at: blogPublishedDateSchema,
  meta_title: blogMetaTitleSchema,
  meta_description: blogMetaDescriptionSchema,
  meta_keywords: blogMetaKeywordsSchema,
  category: blogCategorySchema,
  tags: blogTagsSchema,
});

export const updateBlogSchema = createBlogSchema.partial().extend({
  slug: blogSlugSchema.optional(),
  content: blogContentSchema.optional(),
});

// Type exports for TypeScript
export type CreateBlogInput = z.infer<typeof createBlogSchema>;
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>;

// Field-level validation helpers
export const validateBlogField = {
  title: (value: string | undefined | null) => {
    if (!value) return "Title is required";
    const result = blogTitleSchema.safeParse(value);
    if (result.success) return null;
    return result.error?.issues?.[0]?.message || "Invalid title";
  },
  slug: (value: string | undefined | null) => {
    if (!value) return "Slug is required";
    const result = blogSlugSchema.safeParse(value);
    if (result.success) return null;
    return result.error?.issues?.[0]?.message || "Invalid slug";
  },
  excerpt: (value: string | undefined | null) => {
    if (!value) return null; // Excerpt is optional
    const result = blogExcerptSchema.safeParse(value);
    if (result.success) return null;
    return result.error?.issues?.[0]?.message || "Invalid excerpt";
  },
  content: (value: string | undefined | null) => {
    if (!value) return "Content is required";
    const result = blogContentSchema.safeParse(value);
    if (result.success) return null;
    return result.error?.issues?.[0]?.message || "Invalid content";
  },
  metaTitle: (value: string | undefined | null) => {
    if (!value) return null; // Meta title is optional
    const result = blogMetaTitleSchema.safeParse(value);
    if (result.success) return null;
    return result.error?.issues?.[0]?.message || "Invalid meta title";
  },
  metaDescription: (value: string | undefined | null) => {
    if (!value) return null; // Meta description is optional
    const result = blogMetaDescriptionSchema.safeParse(value);
    if (result.success) return null;
    return result.error?.issues?.[0]?.message || "Invalid meta description";
  },
};

