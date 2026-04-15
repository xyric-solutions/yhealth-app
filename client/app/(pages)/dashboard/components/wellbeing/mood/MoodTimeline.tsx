/**
 * @file MoodTimeline Component
 * @description Modern area chart showing mood scores over time
 */

"use client";

import { useEffect, useState } from "react";
import { Loader2, Calendar, RefreshCw } from "lucide-react";
import { moodService } from "@/src/shared/services/wellbeing.service";
import { format, subDays } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MoodTimelineProps {
  days?: number;
}

interface ChartEntry {
  date: string;
  fullDate: string;
  mood: number;
  emoji: string;
}

/* ─────────── Custom Tooltip ─────────── */

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartEntry }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg bg-[#1a1a28] border border-white/[0.08] px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {entry.payload.emoji && (
          <span className="text-base">{entry.payload.emoji}</span>
        )}
        <span className="text-white font-bold text-sm">
          {entry.value.toFixed(1)}
        </span>
        <span className="text-slate-500">/10</span>
      </div>
    </div>
  );
}

/* ─────────── Component ─────────── */

export function MoodTimeline({ days = 30 }: MoodTimelineProps) {
  const [timeline, setTimeline] = useState<ChartEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTimeline();

    const handleMoodLogged = () => loadTimeline();
    window.addEventListener("mood-logged", handleMoodLogged);
    return () => window.removeEventListener("mood-logged", handleMoodLogged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const loadTimeline = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = subDays(new Date(), days).toISOString().split("T")[0];

      const result = await moodService.getTimeline(startDate, endDate);

      if (result.success && result.data) {
        const chartData = result.data.timeline
          .filter(
            (item) =>
              item.averageRating !== undefined && item.averageRating !== null
          )
          .map((item) => ({
            date: format(new Date(item.date), "MMM d"),
            fullDate: item.date,
            mood: item.averageRating || 0,
            emoji: item.moodEmoji || "",
          }));
        setTimeline(chartData);
      } else {
        setError(result.error?.message || "Failed to load timeline");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load timeline");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400/80 text-xs">{error}</p>
        <button
          onClick={loadTimeline}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 text-xs font-medium transition-colors border border-white/[0.06]"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center">
          <Calendar className="w-5 h-5 text-slate-600" />
        </div>
        <p className="text-sm text-slate-400 font-medium">No mood data yet</p>
        <p className="text-xs text-slate-600">
          Start logging your mood to see trends
        </p>
      </div>
    );
  }

  return (
    <div className="h-72 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={timeline}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
              <stop offset="50%" stopColor="#a855f7" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="moodStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#e879f9" />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.03)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.15)"
            style={{ fontSize: "10px" }}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            domain={[0, 10]}
            stroke="rgba(255,255,255,0.15)"
            style={{ fontSize: "10px" }}
            tickLine={false}
            axisLine={false}
            ticks={[0, 2.5, 5, 7.5, 10]}
            dx={-4}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke: "rgba(168, 85, 247, 0.2)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />
          <Area
            type="monotone"
            dataKey="mood"
            stroke="url(#moodStroke)"
            strokeWidth={2.5}
            fill="url(#moodGradient)"
            dot={{
              fill: "#a855f7",
              r: 3,
              stroke: "#0f0f18",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 5,
              fill: "#c084fc",
              stroke: "#0f0f18",
              strokeWidth: 2,
            }}
            isAnimationActive={true}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
