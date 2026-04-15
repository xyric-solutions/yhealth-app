"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitize";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Play,
  Video,
  Loader2,
  Star,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

interface Webinar {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  category: string;
  status: string;
  host_name: string | null;
  host_title: string | null;
  host_avatar: string | null;
  featured_image: string | null;
  scheduled_at: string | null;
  duration_minutes: number;
  max_attendees: number | null;
  meeting_url: string | null;
  recording_url: string | null;
  registration_count: number;
  views: number;
  is_featured: boolean;
}

export default function WebinarDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registered, _setRegistered] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const fetchWebinar = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<Webinar>(`/webinars/${slug}`);
        if (res.success && res.data) {
          setWebinar(res.data);
        } else {
          throw new Error("Webinar not found");
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Webinar not found");
      } finally {
        setIsLoading(false);
      }
    };
    fetchWebinar();
  }, [slug]);

  const formatDate = (date: string | null) => {
    if (!date) return "TBA";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isUpcoming = webinar?.scheduled_at ? new Date(webinar.scheduled_at) > new Date() : false;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
            <p className="text-muted-foreground">Loading webinar...</p>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  if (error || !webinar) {
    return (
      <MainLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
        >
          <Video className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Webinar Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "This webinar may have been removed."}</p>
          <Button asChild variant="outline">
            <Link href="/webinars">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Webinars
            </Link>
          </Button>
        </motion.div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <article className="relative min-h-screen py-12">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="absolute bottom-0 right-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl"
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
              <Link href="/webinars" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Webinars
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

            {/* Featured image / video placeholder */}
            <div className="relative aspect-video bg-gradient-to-br from-emerald-500/20 via-sky-500/10 to-sky-600/20 flex items-center justify-center">
              {webinar.featured_image ? (
                <Image
                  src={webinar.featured_image}
                  alt={webinar.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
                >
                  <Play className="w-12 h-12 text-emerald-400/80" />
                </motion.div>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                {webinar.is_featured && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                    <Star className="w-3 h-3" /> Featured
                  </span>
                )}
                {isUpcoming && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                    Upcoming
                  </span>
                )}
                {webinar.status === "completed" && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-muted-foreground text-xs font-medium">
                    Recording Available
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 md:p-10">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-medium capitalize bg-gradient-to-r from-emerald-500/20 to-sky-500/20 border border-emerald-500/30 text-emerald-400 mb-4">
                {webinar.category.replace(/-/g, " ")}
              </span>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl md:text-4xl font-bold mb-6"
              >
                {webinar.title}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-8"
              >
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500/70" />
                  {formatDate(webinar.scheduled_at)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {webinar.duration_minutes} min
                </span>
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {webinar.registration_count} registered
                </span>
                {webinar.host_name && (
                  <span>
                    Hosted by {webinar.host_name}
                    {webinar.host_title && ` · ${webinar.host_title}`}
                  </span>
                )}
              </motion.div>

              {webinar.description && (
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="text-lg text-muted-foreground mb-8 leading-relaxed"
                >
                  {webinar.description}
                </motion.p>
              )}

              {webinar.content && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(webinar.content) }}
                  className="prose prose-invert max-w-none [&_p]:mb-4 [&_a]:text-emerald-400 [&_a]:hover:text-sky-400 mb-8"
                />
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap gap-3"
              >
                {webinar.recording_url && (
                  <Button asChild className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white">
                    <a href={webinar.recording_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <Play className="w-4 h-4" />
                      Watch Recording
                    </a>
                  </Button>
                )}
                {webinar.meeting_url && isUpcoming && (
                  <Button asChild variant="outline" className="border-emerald-500/30 hover:bg-emerald-500/10 gap-2">
                    <a href={webinar.meeting_url} target="_blank" rel="noopener noreferrer">
                      <Video className="w-4 h-4" />
                      Join Live
                    </a>
                  </Button>
                )}
                {isUpcoming && !registered && (
                  <Button asChild className="gap-2">
                    <Link href={`/contact?webinar=${webinar.id}`}>
                      <Mail className="w-4 h-4" />
                      Get Notified
                    </Link>
                  </Button>
                )}
                {registered && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    You&apos;re registered
                  </span>
                )}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </article>
    </MainLayout>
  );
}
