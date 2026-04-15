/**
 * @file MindfulnessRecommendation Component
 * @description Display AI-recommended mindfulness practices
 */

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { mindfulnessService } from "@/src/shared/services/wellbeing.service";
import type { MindfulnessPractice } from "@shared/types/domain/wellbeing";

export function MindfulnessRecommendation() {
  const [practice, setPractice] = useState<MindfulnessPractice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendation();
  }, []);

  const loadRecommendation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mindfulnessService.getRecommendation();

      if (result.success && result.data) {
        setPractice(result.data.practice);
      } else {
        setError(result.error?.message || "Failed to load recommendation");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load recommendation");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-violet-600/5 to-purple-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Mindfulness Recommendation</h3>
          </div>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-violet-600/5 to-purple-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Mindfulness Recommendation</h3>
          </div>
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadRecommendation}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!practice) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-violet-600/5 to-purple-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Mindfulness Recommendation</h3>
          </div>
          <p className="text-slate-400 text-sm text-center py-8">
            No recommendation at this time. Check back later!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-violet-600/5 to-purple-600/5" />
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Recommended Practice</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadRecommendation}
            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/20"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">{practice.practiceName}</h3>
            {practice.practiceCategory && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 capitalize mb-3">
                {practice.practiceCategory.replace(/_/g, " ")}
              </span>
            )}
          </div>
          {practice.instructions && practice.instructions.length > 0 && (
            <div className="p-4 rounded-lg bg-slate-800/50 border border-emerald-500/10">
              <ol className="list-decimal list-inside space-y-2 text-sm text-white">
                {practice.instructions.map((instruction, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {instruction.instruction}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {practice.durationMinutes && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Duration: {practice.durationMinutes} minutes</span>
            </div>
          )}
          {practice.whyItHelps && (
            <div className="pt-2 border-t border-emerald-500/20">
              <p className="text-xs text-slate-400 mb-1">Why it helps:</p>
              <p className="text-sm text-slate-300">{practice.whyItHelps}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

