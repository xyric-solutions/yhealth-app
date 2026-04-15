"use client";

/**
 * Skeleton loading states for Money Map sections.
 * Uses CSS shimmer animation for performance (no JS animations during loading).
 */

const shimmerClass = "relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent before:animate-[shimmer_1.5s_infinite] before:-translate-x-full";

function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`bg-white/[0.05] rounded-xl ${shimmerClass} ${className}`} />;
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <SkeletonBox className="h-44 rounded-2xl" />
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <SkeletonBox key={i} className="h-24 rounded-2xl" />)}
      </div>
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonBox className="h-72 rounded-2xl" />
        <SkeletonBox className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

export function TransactionsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBox className="h-12 rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => <SkeletonBox key={i} className="h-8 w-20 rounded-lg" />)}
      </div>
      <div className="space-y-2">
        <SkeletonBox className="h-5 w-32 rounded-md" />
        {[1, 2, 3, 4, 5].map(i => <SkeletonBox key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <SkeletonBox className="lg:col-span-7 h-80 rounded-2xl" />
        <SkeletonBox className="lg:col-span-5 h-80 rounded-2xl" />
      </div>
      <SkeletonBox className="h-60 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonBox className="h-56 rounded-2xl" />
        <SkeletonBox className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}

export function BudgetsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonBox className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <SkeletonBox key={i} className="h-52 rounded-2xl" />)}
      </div>
    </div>
  );
}

export function GoalsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonBox className="h-14 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <SkeletonBox key={i} className="h-48 rounded-2xl" />)}
      </div>
    </div>
  );
}
