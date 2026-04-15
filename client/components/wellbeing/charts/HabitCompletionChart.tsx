"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format } from "date-fns";

interface HabitCompletionDataPoint {
  date: string;
  completionRate: number;
  completed: number;
  total: number;
}

interface HabitCompletionChartProps {
  data: HabitCompletionDataPoint[];
  dateRange: "today" | "7d" | "30d";
  isLoading?: boolean;
}

// Placeholder data generator
export function generatePlaceholderHabitData(
  dateRange: "today" | "7d" | "30d"
): HabitCompletionDataPoint[] {
  const days = dateRange === "today" ? 1 : dateRange === "7d" ? 7 : 30;
  const data: HabitCompletionDataPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const total = 5;
    const completed = Math.floor(Math.random() * (total + 1));
    data.push({
      date: date.toISOString().split("T")[0],
      completionRate: (completed / total) * 100,
      completed,
      total,
    });
  }

  return data;
}

const getBarColor = (rate: number) => {
  if (rate >= 80) return "#10b981"; // emerald-500
  if (rate >= 60) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
};

export function HabitCompletionChart({
  data,
  dateRange,
  isLoading = false,
}: HabitCompletionChartProps) {
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
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
          label={{
            value: "Completion %",
            angle: -90,
            position: "insideLeft",
            fill: "#9ca3af",
          }}
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
          formatter={(value: number | undefined, name?: string, props?: { payload?: HabitCompletionDataPoint }) => {
            const payload = props?.payload;
            const val = value ?? 0;
            if (!payload) {
              return [`${val.toFixed(0)}%`, "Completion Rate"];
            }
            return [
              `${val.toFixed(0)}%`,
              `Completion Rate (${payload.completed}/${payload.total} habits)`,
            ];
          }}
          labelFormatter={(label) => formatDate(label)}
        />
        <Bar dataKey="completionRate" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.completionRate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

