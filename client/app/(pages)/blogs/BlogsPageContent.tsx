"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { MainLayout } from "@/components/layout";
import { BlogCard } from "@/components/blog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import type { BlogCardProps } from "@/components/blog/BlogCard";

// Backend returns: { success: true, data: BlogCardProps[], meta: { page, limit, total, totalPages, ... } }

export default function BlogsPageContent() {
  const [blogs, setBlogs] = useState<BlogCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchBlogs = async (pageNum: number = 1, search: string = "") => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {
        page: pageNum.toString(),
        limit: "12",
      };

      if (search) {
        params.search = search;
      }

      const response = await api.get<BlogCardProps[]>("/blogs", { params });

      if (response.success && response.data) {
        // Backend returns: { success: true, data: BlogCardProps[], meta: { page, limit, total, totalPages, ... } }
        const blogs = Array.isArray(response.data) ? response.data : [];
        const meta = response.meta;

        setBlogs(blogs);
        setTotalPages(meta?.totalPages || 1);
        setTotal(meta?.total || 0);
      } else {
        throw new Error("Failed to fetch blogs");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load blogs. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs(page, searchQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBlogs(1, searchQuery);
  };

  return (
    <MainLayout>
      <div className="relative min-h-screen py-12">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Our <span className="gradient-text-animated">Blog</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover insights, tips, and stories about health, wellness, and living your best
              life.
            </p>
          </motion.div>

          {/* Search */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSearch}
            className="max-w-2xl mx-auto mb-12"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search blogs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={loading}>
                Search
              </Button>
            </div>
          </motion.form>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-lg text-muted-foreground">{error}</p>
              <Button onClick={() => fetchBlogs(page, searchQuery)} className="mt-4">
                Try Again
              </Button>
            </motion.div>
          )}

          {/* Blog Grid */}
          {!loading && !error && (
            <>
              {blogs.length > 0 ? (
                <>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {blogs.map((blog, index) => (
                      <motion.div
                        key={blog.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <BlogCard {...blog} />
                      </motion.div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages} ({total} total)
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <p className="text-lg text-muted-foreground">
                    {searchQuery ? "No blogs found matching your search." : "No blogs available yet."}
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

