"use client";

import { motion } from "framer-motion";
import { ChartCard } from "./cards/ChartCard";
import {
  WellbeingTrendChart,
  generatePlaceholderTrendData,
} from "./charts/WellbeingTrendChart";
import {
  HabitCompletionChart,
  generatePlaceholderHabitData,
} from "./charts/HabitCompletionChart";

type DateRange = "today" | "7d" | "30d";

interface WellbeingAnalyticsProps {
  dateRange: DateRange;
  isLoading?: boolean;
}

export function WellbeingAnalytics({
  dateRange,
  isLoading = false,
}: WellbeingAnalyticsProps) {
  // TODO: Replace with real API data
  const trendData = generatePlaceholderTrendData(dateRange);
  const habitData = generatePlaceholderHabitData(dateRange);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.4 }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      {/* Wellbeing Trend Chart */}
      <ChartCard
        title="Wellbeing Trend"
        description={`${dateRange === "today" ? "Today" : dateRange === "7d" ? "Last 7 days" : "Last 30 days"} wellbeing score`}
        isLoading={isLoading}
        isEmpty={trendData.length === 0}
        emptyMessage="No trend data available"
      >
        <WellbeingTrendChart
          data={trendData}
          dateRange={dateRange}
          isLoading={isLoading}
        />
      </ChartCard>

      {/* Habit Completion Chart */}
      <ChartCard
        title="Habit Completion Rate"
        description={`Daily habit completion ${dateRange === "today" ? "today" : dateRange === "7d" ? "this week" : "this month"}`}
        isLoading={isLoading}
        isEmpty={habitData.length === 0}
        emptyMessage="No habit data available"
      >
        <HabitCompletionChart
          data={habitData}
          dateRange={dateRange}
          isLoading={isLoading}
        />
      </ChartCard>
    </motion.div>
  );
}

