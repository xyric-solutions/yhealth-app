"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Video,
  Search,
  Calendar,
  Clock,
  Users,
  ArrowRight,
  Loader2,
  Play,

  Star,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import { api } from "@/lib/api-client";

interface Webinar {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  status: string;
  host_name: string | null;
  host_title: string | null;
  featured_image: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  registration_count: number;
  is_featured: boolean;
}

interface WebinarCategory {
  category: string;
  count: number;
}

export default function WebinarsPageContent() {
  const heroRef = useRef(null);
  const webinarsRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const webinarsInView = useInView(webinarsRef, { once: true, margin: "-100px" });

  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [categories, setCategories] = useState<WebinarCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: "12" });
        if (search) params.set("search", search);
        if (selectedCategory) params.set("category", selectedCategory);
        const [webinarsRes, catsRes] = await Promise.all([
          api.get<Webinar[]>(`/webinars?${params.toString()}`),
          api.get<WebinarCategory[]>("/webinars/categories"),
        ]);
        setWebinars(webinarsRes.data || []);
        setCategories(catsRes.data || []);
      } catch {
        setWebinars([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [search, selectedCategory]);

  const formatDate = (date: string | null) => {
    if (!date) return "TBA";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isUpcoming = (date: string | null) => {
    if (!date) return false;
    return new Date(date) > new Date();
  };

  const featuredWebinar = webinars.find((w) => w.is_featured);
  const regularWebinars = webinars.filter((w) => !w.is_featured || webinars.indexOf(w) > 0);

  return (
    <MainLayout>
      {/* HERO */}
      <section ref={heroRef} className="relative min-h-[45vh] flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 right-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
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
                <Video className="w-4 h-4 text-primary" />
                <span className="gradient-text font-semibold">Webinars</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
            >
              Learn from <span className="gradient-text">Experts</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-xl mx-auto"
            >
              Join live webinars and watch recordings on fitness, nutrition, mental health, and AI-powered wellness.
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
                  placeholder="Search webinars..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-foreground text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 backdrop-blur-sm"
                />
              </div>
            </motion.div>

            {/* Category Filters */}
            {categories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="flex flex-wrap justify-center gap-2"
              >
                <button
                  onClick={() => setSelectedCategory("")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === "" ? "bg-primary text-white" : "glass-card hover:border-primary/30"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() => setSelectedCategory(cat.category)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                      selectedCategory === cat.category ? "bg-primary text-white" : "glass-card hover:border-primary/30"
                    }`}
                  >
                    {cat.category.replace(/-/g, " ")} ({cat.count})
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* FEATURED WEBINAR */}
      {featuredWebinar && (
        <section className="relative py-8 overflow-hidden">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link
                href={`/webinars/${featuredWebinar.slug}`}
                className="glass-card p-6 sm:p-8 rounded-3xl block group hover:border-primary/20 transition-all max-w-4xl mx-auto relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-sky-600" />
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">Featured Webinar</span>
                  {isUpcoming(featuredWebinar.scheduled_at) && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">
                      Upcoming
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                  {featuredWebinar.title}
                </h3>
                {featuredWebinar.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {featuredWebinar.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  {featuredWebinar.host_name && (
                    <span>Hosted by <strong className="text-foreground">{featuredWebinar.host_name}</strong></span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(featuredWebinar.scheduled_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {featuredWebinar.duration_minutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {featuredWebinar.registration_count} registered
                  </span>
                </div>
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* WEBINAR GRID */}
      <section ref={webinarsRef} className="relative py-16 overflow-hidden">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : webinars.length === 0 ? (
            <div className="text-center py-16">
              <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No webinars found. Check back soon for upcoming events!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {regularWebinars.map((webinar, index) => (
                <motion.div
                  key={webinar.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={webinarsInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Link
                    href={`/webinars/${webinar.slug}`}
                    className="glass-card rounded-2xl block group hover:border-primary/20 transition-all h-full overflow-hidden"
                  >
                    {/* Image placeholder */}
                    <div className="aspect-video bg-gradient-to-br from-emerald-500/10 to-sky-500/10 flex items-center justify-center relative">
                      <Play className="w-10 h-10 text-primary/50" />
                      {isUpcoming(webinar.scheduled_at) ? (
                        <span className="absolute top-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 backdrop-blur-sm">
                          Upcoming
                        </span>
                      ) : webinar.status === "completed" ? (
                        <span className="absolute top-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground backdrop-blur-sm">
                          Recording
                        </span>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 capitalize text-muted-foreground">
                          {webinar.category.replace(/-/g, " ")}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                        {webinar.title}
                      </h3>
                      {webinar.host_name && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {webinar.host_name}
                          {webinar.host_title && <span className="text-muted-foreground/50"> - {webinar.host_title}</span>}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(webinar.scheduled_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {webinar.duration_minutes}m
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={webinarsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="max-w-3xl mx-auto mt-12 text-center glass-card p-8 rounded-3xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-sky-600" />
            <h3 className="text-xl font-bold mb-2">Never Miss a Webinar</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sign up to get notified about upcoming live events and new recordings
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold text-sm hover:from-emerald-600 hover:to-sky-600 transition-all"
            >
              Get Notified
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
