'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface ChatSkeletonProps {
  messageCount?: number;
}

export function ChatSkeleton({ messageCount = 3 }: ChatSkeletonProps) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: messageCount }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

