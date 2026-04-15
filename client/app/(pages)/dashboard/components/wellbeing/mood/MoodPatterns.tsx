/**
 * @file MoodPatterns Component
 * @description Display mood pattern insights and trends
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, TrendingUp, Clock, Heart } from "lucide-react";
import { moodService } from "@/src/shared/services/wellbeing.service";

interface MoodPatternsProps {
  days?: number;
}

export function MoodPatterns({ days = 30 }: MoodPatternsProps) {
  const [patterns, setPatterns] = useState<{ timeOfDay?: Record<string, number>; averageRatings?: Record<string, number>; dominantEmotions?: Array<{ tag: string; frequency: number }> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPatterns();
    
    // Listen for mood log events to refresh patterns
    const handleMoodLogged = () => {
      loadPatterns();
    };
    
    window.addEventListener('mood-logged', handleMoodLogged);
    return () => {
      window.removeEventListener('mood-logged', handleMoodLogged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const loadPatterns = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await moodService.getPatterns(days);

      if (result.success && result.data) {
        setPatterns(result.data.patterns);
      } else {
        setError(result.error?.message || "Failed to load patterns");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load patterns");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-purple-600/5 to-pink-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Mood Patterns</h3>
          </div>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !patterns) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-purple-600/5 to-pink-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Mood Patterns</h3>
          </div>
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-2">{error || "No patterns available"}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={loadPatterns}
              className="px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm transition-colors border border-emerald-500/30"
            >
              Retry
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  const timeOfDay = patterns.timeOfDay || {};
  const avgRatings = patterns.averageRatings || {};
  const dominantEmotions = patterns.dominantEmotions || [];

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-purple-600/5 to-pink-600/5" />
      <div className="relative p-6 space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Mood Patterns ({days} days)</h3>
        </div>
        {/* Time of Day Patterns */}
        {Object.keys(timeOfDay).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time of Day Patterns
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(timeOfDay).map(([period, value]) => (
                <div
                  key={period}
                  className="p-4 rounded-lg bg-white/5 border border-white/10"
                >
                  <p className="text-xs text-slate-400 mb-1 capitalize">{period}</p>
                  <p className="text-2xl font-bold text-white">
                    {typeof value === "number" ? value.toFixed(1) : "N/A"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Average Ratings (Deep Mode) */}
        {Object.keys(avgRatings).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Average Ratings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(avgRatings).map(([metric, value]) => (
                <div
                  key={metric}
                  className="p-4 rounded-lg bg-white/5 border border-white/10"
                >
                  <p className="text-xs text-slate-400 mb-1 capitalize">{metric}</p>
                  <p className="text-2xl font-bold text-white">
                    {typeof value === "number" ? value.toFixed(1) : "N/A"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dominant Emotions */}
        {dominantEmotions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-4">Most Common Emotions</h3>
            <div className="space-y-2">
              {dominantEmotions.slice(0, 5).map((item: { tag: string; frequency: number }, _index: number) => (
                <div
                  key={item.tag}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <span className="text-sm text-white capitalize">{item.tag}</span>
                  <span className="text-sm font-medium text-purple-400">{item.frequency}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

