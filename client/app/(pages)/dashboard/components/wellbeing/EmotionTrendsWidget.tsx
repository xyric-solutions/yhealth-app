"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Settings,
  Shield,
  Trash2,
  Eye,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { confirm } from "@/components/common/ConfirmDialog";
import {
  emotionService,
  type EmotionTrend,
  type EmotionCategory,
  type EmotionPreferences,
  getEmotionColor,
  getEmotionEmoji,
  getEmotionLabel,
} from "@/src/shared/services/emotion.service";

interface EmotionTrendsWidgetProps {
  compact?: boolean;
  showPrivacyControls?: boolean;
  onViewDetails?: () => void;
}

export function EmotionTrendsWidget({
  compact = false,
  showPrivacyControls = true,
  onViewDetails,
}: EmotionTrendsWidgetProps) {
  const [trends, setTrends] = useState<EmotionTrend | null>(null);
  const [preferences, setPreferences] = useState<EmotionPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [trendsResponse, prefsResponse] = await Promise.all([
        emotionService.getTrends(14),
        emotionService.getPreferences(),
      ]);
      if (trendsResponse.success && trendsResponse.data) setTrends(trendsResponse.data);
      if (prefsResponse.success && prefsResponse.data) setPreferences(prefsResponse.data);
    } catch (err: unknown) {
      console.error("Failed to load emotion data:", err);
      setError((err as Error).message || "Failed to load emotion data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLogging = async () => {
    if (!preferences) return;
    try {
      const response = await emotionService.updatePreferences({
        emotionLoggingEnabled: !preferences.emotionLoggingEnabled,
      });
      if (response.success) {
        setPreferences({ ...preferences, emotionLoggingEnabled: !preferences.emotionLoggingEnabled });
      }
    } catch (err) { console.error("Failed to update preferences:", err); }
  };

  const handleDeleteAllLogs = async () => {
    const confirmed = await confirm({
      title: "Delete All Emotion Data",
      description: "Are you sure you want to delete all emotion data? This cannot be undone.",
      confirmText: "Delete", cancelText: "Cancel", variant: "destructive",
    });
    if (!confirmed) return;
    try {
      const response = await emotionService.deleteAllLogs();
      if (response.success) { setTrends(null); loadData(); }
    } catch (err) { console.error("Failed to delete emotion logs:", err); }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.5))' }} />;
      case "declining": return <TrendingDown className="w-3.5 h-3.5 text-red-400" style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' }} />;
      default: return <Minus className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getTrendLabel = (trend?: string) => {
    switch (trend) {
      case "improving": return "Improving";
      case "declining": return "Needs attention";
      default: return "Stable";
    }
  };

  const getTrendColor = (trend?: string) => {
    switch (trend) {
      case "improving": return { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)', text: 'text-emerald-400' };
      case "declining": return { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)', text: 'text-red-400' };
      default: return { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.12)', text: 'text-slate-400' };
    }
  };

  const getTopEmotions = (): Array<{ category: EmotionCategory; count: number; percentage: number }> => {
    if (!trends?.emotionDistribution) return [];
    const total = Object.values(trends.emotionDistribution).reduce((sum, count) => sum + count, 0);
    if (total === 0) return [];
    return Object.entries(trends.emotionDistribution)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, count]) => ({
        category: category as EmotionCategory, count,
        percentage: (count / total) * 100,
      }));
  };

  // ─── Card shell style (shared) ──────────────────────────────
  const cardStyle = {
    background: 'linear-gradient(145deg, rgba(18,20,35,0.95) 0%, rgba(12,13,30,0.98) 50%, rgba(8,10,22,1) 100%)',
    border: '1px solid rgba(236,72,153,0.18)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.25), 0 0 40px rgba(236,72,153,0.06), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.3)',
  };

  // ─── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
        </div>
      </div>
    );
  }

  // ─── Disabled ───────────────────────────────────────────────
  if (preferences && !preferences.emotionLoggingEnabled) {
    return (
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-pink-400" style={{ filter: 'drop-shadow(0 0 4px rgba(236,72,153,0.5))' }} />
          <h3 className="font-bold text-white text-sm">Emotional Wellbeing</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="p-3 rounded-xl mb-3" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.08)' }}>
            <Shield className="w-8 h-8 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm mb-4">Emotion tracking is currently disabled</p>
          <button onClick={handleToggleLogging}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-pink-400 transition-all"
            style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.2)', boxShadow: '0 0 12px rgba(236,72,153,0.08)' }}>
            Enable Emotion Tracking
          </button>
        </div>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-pink-400" />
          <h3 className="font-bold text-white text-sm">Emotional Wellbeing</h3>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const topEmotions = getTopEmotions();
  const trendStyle = getTrendColor(trends?.trend);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      className="group/emotion relative rounded-2xl overflow-hidden"
      style={cardStyle}
    >
      {/* Top edge light */}
      <div className="absolute top-0 left-[8%] right-[8%] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)' }} />

      {/* Ambient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none opacity-40 group-hover/emotion:opacity-80 transition-opacity duration-700"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="p-4 sm:p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg"
              style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.18)' }}>
              <Heart className="w-4 h-4 text-pink-400" style={{ filter: 'drop-shadow(0 0 4px rgba(236,72,153,0.5))' }} />
            </div>
            <h3 className="font-bold text-white text-sm tracking-tight">Emotional Wellbeing</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {showPrivacyControls && (
              <button onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all border border-transparent hover:border-white/[0.06]">
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
            {onViewDetails && (
              <button onClick={onViewDetails}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all border border-transparent hover:border-white/[0.06]">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">Emotion Logging</span>
                  </div>
                  <button onClick={handleToggleLogging}
                    className="relative w-10 h-5 rounded-full transition-colors"
                    style={{ background: preferences?.emotionLoggingEnabled ? 'rgba(236,72,153,0.5)' : 'rgba(100,116,139,0.3)' }}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferences?.emotionLoggingEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>
                <button onClick={handleDeleteAllLogs}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-sm font-medium text-red-400 transition-all"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                  <Trash2 className="w-4 h-4" /> Delete All Emotion Data
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {!trends || topEmotions.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.1)' }}>
              <span className="text-3xl">😶</span>
            </div>
            <p className="text-sm text-slate-400">No emotion data yet. Start a voice call to track emotions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Primary emotion */}
            <div className="flex flex-col items-center text-center py-2">
              <motion.span className="text-5xl sm:text-6xl mb-2"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>
                {getEmotionEmoji(trends.dominantEmotion)}
              </motion.span>
              <h4 className="text-xl sm:text-2xl font-extrabold text-white"
                style={{ textShadow: '0 0 16px rgba(236,72,153,0.2)' }}>
                {getEmotionLabel(trends.dominantEmotion)}
              </h4>
              <p className="text-[10px] text-slate-500 mt-1 font-medium uppercase tracking-wider">Primary Emotion</p>
            </div>

            {/* Confidence + Trend chips */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] text-slate-500">Confidence</span>
                <span className="text-xs font-bold text-white ml-auto tabular-nums">{trends.averageConfidence}%</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{ background: trendStyle.bg, border: `1px solid ${trendStyle.border}` }}>
                {getTrendIcon(trends.trend)}
                <span className={`text-[11px] font-semibold ${trendStyle.text}`}>{getTrendLabel(trends.trend)}</span>
              </div>
            </div>

            {/* Distribution bars */}
            {!compact && (
              <div className="space-y-2.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-bold">Last 14 Days</p>
                {topEmotions.map(({ category, percentage }) => (
                  <div key={category} className="flex items-center gap-3">
                    <span className="text-lg" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                      {getEmotionEmoji(category)}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-300 font-medium">{getEmotionLabel(category)}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums font-semibold">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: getEmotionColor(category),
                            boxShadow: `0 0 8px ${getEmotionColor(category)}44`,
                          }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent emotions */}
            {!compact && trends.recentEmotions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-bold">Recent</p>
                <div className="flex gap-1.5 flex-wrap">
                  {trends.recentEmotions.slice(0, 8).map((emotion, index) => (
                    <motion.div key={index}
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.04 }}
                      className="px-2 py-1 rounded-lg flex items-center gap-1"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      title={`${getEmotionLabel(emotion.category)} - ${emotion.confidence}% confidence`}>
                      <span className="text-sm">{getEmotionEmoji(emotion.category)}</span>
                      <span className="text-[11px] text-slate-400 font-medium">{getEmotionLabel(emotion.category)}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </motion.div>
  );
}
