"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface TrendDataPoint {
  date: string;
  score: number;
}

interface WellbeingTrendChartProps {
  data: TrendDataPoint[];
  dateRange: "today" | "7d" | "30d";
  isLoading?: boolean;
}

// Placeholder data generator
export function generatePlaceholderTrendData(
  dateRange: "today" | "7d" | "30d"
): TrendDataPoint[] {
  const days = dateRange === "today" ? 1 : dateRange === "7d" ? 7 : 30;
  const data: TrendDataPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split("T")[0],
      score: Math.floor(Math.random() * 30) + 60, // 60-90 range
    });
  }

  return data;
}

export function WellbeingTrendChart({
  data,
  dateRange,
  isLoading = false,
}: WellbeingTrendChartProps) {
  if (isLoading) {
    return (
      <div className="h-64 w-full animate-pulse rounded-lg bg-slate-700/30" />
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (dateRange === "today") {
      return format(date, "HH:mm");
    }
    if (dateRange === "7d") {
      return format(date, "EEE");
    }
    return format(date, "MMM d");
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="wellbeingGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="date"
          stroke="#9ca3af"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          tickFormatter={formatDate}
          tickLine={{ stroke: "#4b5563" }}
        />
        <YAxis
          domain={[0, 100]}
          stroke="#9ca3af"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          tickLine={{ stroke: "#4b5563" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "12px",
            padding: "12px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
          }}
          labelStyle={{ color: "#fff", marginBottom: "8px", fontWeight: 600 }}
          formatter={(value: number | undefined) => [`${value ?? 0}`, "Wellbeing Score"]}
          labelFormatter={(label) => formatDate(label)}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ fill: "#10b981", r: 4, strokeWidth: 2, stroke: "#1f2937" }}
          activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
          fill="url(#wellbeingGradient)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

