"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, BookOpen } from "lucide-react";
import { MainLayout } from "@/components/layout";
import { BlogDetailContent } from "./BlogDetailContent";
import { api, ApiError } from "@/lib/api-client";

interface BlogDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  markdown_content?: string | null;
  featured_image: string | null;
  author_first_name: string;
  author_last_name: string;
  author_avatar: string | null;
  published_at: string | null;
  reading_time: number;
  views?: number;
}

export default function BlogDetailPageContent() {
  const params = useParams();
  const slug = params?.slug as string;

  const [blog, setBlog] = useState<BlogDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
    if (!slug) return;
    const fetchBlog = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<BlogDetail>(`/blogs/${slug}`);
        if (res.success && res.data) {
          setBlog(res.data);
        } else {
          throw new Error("Blog not found");
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Blog not found");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBlog();
  }, [slug]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
            <p className="text-muted-foreground">Loading article...</p>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  if (error || !blog) {
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
        </motion.div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <BlogDetailContent blog={blog} />
    </MainLayout>
  );
}
