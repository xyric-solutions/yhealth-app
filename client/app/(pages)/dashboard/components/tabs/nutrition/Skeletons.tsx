/**
 * @file Nutrition Skeleton Components
 * Loading skeleton components for nutrition UI
 */

"use client";

export function DietPlanSkeleton() {
  return (
    <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-5 w-32 bg-slate-700 rounded mb-2" />
          <div className="h-3 w-20 bg-slate-700/50 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-slate-700 rounded-lg" />
          <div className="w-8 h-8 bg-slate-700 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 rounded-xl bg-white/5">
            <div className="h-3 w-12 bg-slate-700/50 rounded mb-2" />
            <div className="h-6 w-16 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MealSkeleton() {
  return (
    <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-700" />
        <div className="flex-1">
          <div className="h-5 w-24 bg-slate-700 rounded mb-2" />
          <div className="h-3 w-48 bg-slate-700/50 rounded mb-3" />
          <div className="flex gap-3">
            <div className="h-3 w-16 bg-slate-700/30 rounded" />
            <div className="h-3 w-16 bg-slate-700/30 rounded" />
            <div className="h-3 w-16 bg-slate-700/30 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecipeSkeleton() {
  return (
    <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5 animate-pulse">
      <div className="w-full h-32 rounded-xl bg-slate-700 mb-4" />
      <div className="h-5 w-32 bg-slate-700 rounded mb-2" />
      <div className="flex items-center gap-3 mb-3">
        <div className="h-3 w-16 bg-slate-700/50 rounded" />
        <div className="h-3 w-16 bg-slate-700/50 rounded" />
      </div>
      <div className="flex gap-1">
        <div className="h-4 w-16 bg-slate-700/30 rounded-full" />
        <div className="h-4 w-12 bg-slate-700/30 rounded-full" />
      </div>
    </div>
  );
}

export function MacroCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/5 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-slate-700 rounded" />
        <div className="h-3 w-16 bg-slate-700/50 rounded" />
      </div>
      <div className="h-6 w-20 bg-slate-700 rounded mb-2" />
      <div className="h-2 bg-slate-700/30 rounded-full" />
    </div>
  );
}

export function WaterWidgetSkeleton() {
  return (
    <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700 rounded-xl" />
          <div>
            <div className="h-4 w-24 bg-slate-700 rounded mb-2" />
            <div className="h-3 w-16 bg-slate-700/50 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-slate-700 rounded-lg" />
          <div className="w-8 h-8 bg-slate-700 rounded-lg" />
        </div>
      </div>
      <div className="h-2 bg-slate-700/30 rounded-full" />
    </div>
  );
}

export function ShoppingItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 animate-pulse">
      <div className="w-5 h-5 bg-slate-700 rounded" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-slate-700 rounded mb-1" />
        <div className="h-3 w-20 bg-slate-700/50 rounded" />
      </div>
      <div className="w-6 h-6 bg-slate-700 rounded" />
    </div>
  );
}
