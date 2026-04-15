"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  emotionService,
  type EmotionLog,
  type EmotionTrend,
  type EmotionPreferences,
} from "@/src/shared/services/emotion.service";
import { prepareEmotionChartData } from "./emotion-analytics/utils/emotionChartUtils";
import { EmotionHeader } from "./emotion-analytics/components/EmotionHeader";
import { EmotionStatsCards } from "./emotion-analytics/components/EmotionStatsCards";
import { EmotionAnalyticsCharts } from "./emotion-analytics/components/EmotionAnalyticsCharts";
import { PrimaryEmotionDisplay } from "./emotion-analytics/components/PrimaryEmotionDisplay";
import { confirm } from "@/components/common/ConfirmDialog";

interface EmotionAnalyticsProps {
  days?: number;
}

export function EmotionAnalytics({ days = 14 }: EmotionAnalyticsProps) {
  const [logs, setLogs] = useState<EmotionLog[]>([]);
  const [trends, setTrends] = useState<EmotionTrend | null>(null);
  const [preferences, setPreferences] = useState<EmotionPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days);
      
      const [logsResponse, trendsResponse, prefsResponse] = await Promise.all([
        emotionService.getLogs({
          startDate: startDate.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
          limit: 1000, // Get all logs for the period
        }),
        emotionService.getTrends(days),
        emotionService.getPreferences(),
      ]);

      if (logsResponse.success && logsResponse.data) {
        setLogs(logsResponse.data.logs);
      }

      if (trendsResponse.success && trendsResponse.data) {
        setTrends(trendsResponse.data);
      }

      if (prefsResponse.success && prefsResponse.data) {
        setPreferences(prefsResponse.data);
      }
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
        setPreferences({
          ...preferences,
          emotionLoggingEnabled: !preferences.emotionLoggingEnabled,
        });
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  };

  const handleDeleteAllLogs = async () => {
    const confirmed = await confirm({
      title: "Delete All Emotion Data",
      description: "Are you sure you want to delete all emotion data? This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await emotionService.deleteAllLogs();
      if (response.success) {
        setLogs([]);
        setTrends(null);
        loadData();
      }
    } catch (err) {
      console.error("Failed to delete emotion logs:", err);
    }
  };

  // Prepare chart data
  const chartData = useMemo(() => prepareEmotionChartData(logs, days), [logs, days]);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Disabled state
  if (preferences && !preferences.emotionLoggingEnabled) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/5 border border-white/10 p-5"
      >
        <EmotionHeader
          preferences={preferences}
          onToggleLogging={handleToggleLogging}
          onDeleteAllLogs={handleDeleteAllLogs}
        />
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Shield className="w-10 h-10 text-slate-500 mb-3" />
          <p className="text-slate-400 mb-4">Emotion tracking is currently disabled</p>
          <Button
            onClick={handleToggleLogging}
            className="bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
          >
            Enable Emotion Tracking
          </Button>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <EmotionHeader
          preferences={preferences}
          onToggleLogging={handleToggleLogging}
          onDeleteAllLogs={handleDeleteAllLogs}
        />
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-xl"
    >
      {/* Header */}
      <EmotionHeader
        preferences={preferences}
        isLoading={isLoading}
        onToggleLogging={handleToggleLogging}
        onDeleteAllLogs={handleDeleteAllLogs}
        onRefresh={loadData}
      />

      {/* Content */}
      <div className="p-5 space-y-6">
        {!trends || chartData.length === 0 || chartData.every((d) => d.total === 0) ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400 mb-4">
              No emotion data yet. Start a voice call to track emotions.
            </p>
            <Button
              onClick={() => window.location.href = '/voice-call'}
              variant="outline"
              size="sm"
            >
              Start Voice Call
            </Button>
          </div>
        ) : (
          <>
            {/* Primary Emotion Display */}
            <PrimaryEmotionDisplay
              dominantEmotion={trends.dominantEmotion}
              trend={trends.trend}
              confidence={trends.averageConfidence}
            />

            {/* Stats Cards */}
            <EmotionStatsCards chartData={chartData} trend={trends.trend} />

            {/* Analytics Charts */}
            <EmotionAnalyticsCharts chartData={chartData} isLoading={isLoading} />
          </>
        )}
      </div>
    </motion.div>
  );
}

