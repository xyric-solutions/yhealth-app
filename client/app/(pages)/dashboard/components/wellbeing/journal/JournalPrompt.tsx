/**
 * @file JournalPrompt Component
 * @description Display AI-personalized journaling prompts
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { journalService, type JournalPrompt as JournalPromptType } from "@/src/shared/services/wellbeing.service";

interface JournalPromptProps {
  onSelectPrompt?: (prompt: JournalPromptType) => void;
  limit?: number;
}

export function JournalPrompt({ onSelectPrompt, limit = 3 }: JournalPromptProps) {
  const [prompts, setPrompts] = useState<JournalPromptType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const loadPrompts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await journalService.getPrompts(limit);

      if (result.success && result.data) {
        setPrompts(result.data.prompts);
      } else {
        setError(result.error?.message || "Failed to load prompts");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load prompts");
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryColor = (category?: string): string => {
    switch (category) {
      case "gratitude":
        return "from-yellow-500/20 to-orange-500/20";
      case "reflection":
        return "from-blue-500/20 to-indigo-500/20";
      case "emotional_processing":
        return "from-purple-500/20 to-pink-500/20";
      case "stress_management":
        return "from-red-500/20 to-rose-500/20";
      case "self_compassion":
        return "from-green-500/20 to-emerald-500/20";
      case "future_focus":
        return "from-cyan-500/20 to-teal-500/20";
      default:
        return "from-gray-500/20 to-slate-500/20";
    }
  };

  const getCategoryGradient = (category?: string): string => {
    switch (category) {
      case "gratitude":
        return "from-yellow-500 to-orange-500";
      case "reflection":
        return "from-blue-500 to-indigo-500";
      case "emotional_processing":
        return "from-purple-500 to-pink-500";
      case "stress_management":
        return "from-red-500 to-rose-500";
      case "self_compassion":
        return "from-green-500 to-emerald-500";
      case "future_focus":
        return "from-cyan-500 to-teal-500";
      default:
        return "from-gray-500 to-slate-500";
    }
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-blue-600/5 to-indigo-600/5" />
        <div className="relative p-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-blue-600/5 to-indigo-600/5" />
        <div className="relative p-6">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPrompts}
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-blue-600/5 to-indigo-600/5" />
        <div className="relative p-6 text-center">
          <p className="text-slate-400">No prompts available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Recommended Prompts</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadPrompts}
          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/20"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid gap-4">
        {prompts.map((prompt, index) => (
          <motion.div
            key={prompt.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className={`
                relative overflow-hidden rounded-xl border border-emerald-500/10 cursor-pointer transition-all
                hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10
                bg-gradient-to-br from-slate-800/50 to-slate-800/30
              `}
              onClick={() => onSelectPrompt?.(prompt)}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${getCategoryColor(prompt.category)} opacity-5`} />
              <div className="relative p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {prompt.category && (
                      <span
                        className={`
                          inline-block px-3 py-1 rounded-full text-xs font-medium mb-3 border
                          bg-gradient-to-r ${getCategoryGradient(prompt.category)} text-white
                        `}
                      >
                        {prompt.category.replace(/_/g, " ")}
                      </span>
                    )}
                    <p className="text-white text-base leading-relaxed">{prompt.text}</p>
                    {prompt.description && (
                      <p className="text-sm text-slate-400 mt-2">{prompt.description}</p>
                    )}
                  </div>
                  <motion.div
                    className="text-2xl"
                    whileHover={{ scale: 1.2, rotate: 15 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    ✨
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

