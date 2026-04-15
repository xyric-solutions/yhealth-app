"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Settings, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmotionPreferences } from "@/src/shared/services/emotion.service";

interface EmotionHeaderProps {
  preferences: EmotionPreferences | null;
  isLoading?: boolean;
  onToggleLogging: () => void;
  onDeleteAllLogs: () => void;
  onRefresh?: () => void;
  showSettings?: boolean;
}

export function EmotionHeader({
  preferences,
  isLoading = false,
  onToggleLogging,
  onDeleteAllLogs,
  showSettings: showSettingsProp = true,
}: EmotionHeaderProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="p-5 border-b border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <Heart className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">Emotional Wellbeing</h3>
            <p className="text-xs text-slate-400 mt-0.5">Track your emotional patterns</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showSettingsProp && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Privacy Settings Panel */}
      <AnimatePresence>
        {showSettings && showSettingsProp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-white/10"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">Emotion Logging</span>
                </div>
                <button
                  onClick={onToggleLogging}
                  disabled={isLoading}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    preferences?.emotionLoggingEnabled
                      ? "bg-pink-500"
                      : "bg-slate-600"
                  } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferences?.emotionLoggingEnabled
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <Button
                onClick={onDeleteAllLogs}
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Emotion Data
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

