"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getEmotionEmoji, getEmotionLabel, getEmotionColor } from "@/src/shared/services/emotion.service";
import type { EmotionCategory } from "@/src/shared/services/emotion.service";

interface PrimaryEmotionDisplayProps {
  dominantEmotion: EmotionCategory;
  trend?: 'improving' | 'stable' | 'declining';
  confidence?: number;
}

export function PrimaryEmotionDisplay({
  dominantEmotion,
  trend,
  confidence,
}: PrimaryEmotionDisplayProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "declining":
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTrendLabel = () => {
    switch (trend) {
      case "improving":
        return "Improving";
      case "declining":
        return "Needs attention";
      default:
        return "Stable";
    }
  };

  const emotionColor = getEmotionColor(dominantEmotion);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20"
    >
      <div className="flex items-center gap-4">
        <div
          className="p-3 rounded-xl"
          style={{
            backgroundColor: `${emotionColor}20`,
            border: `1px solid ${emotionColor}40`,
          }}
        >
          <span className="text-4xl">{getEmotionEmoji(dominantEmotion)}</span>
        </div>
        <div>
          <p className="text-sm text-slate-400 mb-1">Primary Emotion</p>
          <p
            className="text-xl font-semibold"
            style={{ color: emotionColor }}
          >
            {getEmotionLabel(dominantEmotion)}
          </p>
          {confidence !== undefined && (
            <p className="text-xs text-slate-500 mt-1">
              {confidence.toFixed(0)}% confidence
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getTrendIcon()}
        <span className="text-sm text-slate-400">{getTrendLabel()}</span>
      </div>
    </motion.div>
  );
}

