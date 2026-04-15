"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  height?: string;
}

/**
 * Reusable loading skeleton card with fixed height to prevent layout shift
 */
export function SkeletonCard({ className, height = "h-32" }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-xl p-6",
        height,
        className
      )}
    >
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

