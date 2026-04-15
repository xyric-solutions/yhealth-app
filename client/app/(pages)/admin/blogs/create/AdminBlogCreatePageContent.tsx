"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlogFormStepper, type BlogFormData } from "@/components/blog/BlogFormStepper";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function AdminBlogCreatePageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: BlogFormData) => {
    if (!user || user.role !== "admin") {
      setError("Unauthorized");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        slug: formData.slug,
        excerpt: formData.excerpt || null,
        content: formData.content,
        markdown_content: formData.markdown_content || null,
        featured_image: formData.featured_image,
        status: formData.status,
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        meta_keywords: formData.meta_keywords || null,
        category: formData.category || null,
        tags: formData.tags || [],
      };

      if (formData.status === "published") {
        payload.published_at = new Date().toISOString();
      }

      const response = await api.post<{ id: string }>("/admin/blogs", payload);

      if (response.success && response.data) {
        toast.success("Blog created successfully!");
        router.push(`/admin/blogs/${response.data.id}/edit`);
      } else {
        throw new Error("Failed to create blog");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        toast.error(err.message);
      } else {
        const errorMessage = "Failed to create blog. Please try again.";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async (formData: Partial<BlogFormData>) => {
    if (!user || user.role !== "admin") return;

    try {
      const payload: Record<string, unknown> = {
        title: formData.title || "Untitled",
        slug: formData.slug || "untitled",
        excerpt: formData.excerpt || null,
        content: formData.content || "",
        markdown_content: formData.markdown_content || null,
        featured_image: formData.featured_image,
        status: "draft",
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        meta_keywords: formData.meta_keywords || null,
        category: formData.category || null,
        tags: formData.tags || [],
      };

      const response = await api.post<{ id: string }>("/admin/blogs", payload);

      if (response.success && response.data) {
        toast.success("Draft saved!");
      }
    } catch (err: unknown) {
      console.error("Failed to save draft:", err);
      toast.error("Failed to save draft");
    }
  };

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-4 text-slate-400 hover:text-white">
            <Link href="/admin/blogs">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blogs
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">Create New Blog Post</h1>
          <p className="text-slate-400 mt-2">
            Fill out the form below to create a new blog post
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
        >
          {error}
        </motion.div>
      )}

      {/* Form Stepper */}
      <BlogFormStepper
        onSubmit={handleSubmit}
        onSaveDraft={handleSaveDraft}
        isLoading={isLoading}
        mode="create"
      />
    </div>
  );
}
