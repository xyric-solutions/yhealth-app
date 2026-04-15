"use client";

import { cn } from "@/lib/utils";
import { Play } from "lucide-react";

interface YouTubeEmbedProps {
  videoId: string | null;
  isLoading?: boolean;
}

export default function YouTubeEmbed({
  videoId,
  isLoading = false,
}: YouTubeEmbedProps) {
  if (isLoading) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-white/5 border border-white/10">
        <div className="flex items-center justify-center h-full animate-pulse">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
              <Play className="h-5 w-5 text-zinc-600" />
            </div>
            <div className="h-3 w-24 rounded bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!videoId) {
    return (
      <div
        className={cn(
          "aspect-video w-full rounded-xl overflow-hidden",
          "bg-white/3 border border-white/6",
          "flex items-center justify-center"
        )}
      >
        <div className="flex flex-col items-center gap-2 text-zinc-600">
          <Play className="h-8 w-8" />
          <span className="text-[13px]">No video available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
        title="Exercise tutorial"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
