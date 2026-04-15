/**
 * @file EnergyPatterns Component
 * @description Display energy pattern insights and correlations with advanced charts
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Clock, Zap, Sparkles } from "lucide-react";
import { energyService } from "@/src/shared/services/wellbeing.service";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface EnergyPatternsProps {
  days?: number;
}

const COLORS = {
  morning: "#fbbf24",
  afternoon: "#f97316",
  evening: "#ef4444",
  night: "#8b5cf6",
};

const RADAR_COLORS = ["#fbbf24", "#f97316"];

export function EnergyPatterns({ days = 30 }: EnergyPatternsProps) {
  const [patterns, setPatterns] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPatterns();
    
    const handleEnergyLogged = () => {
      loadPatterns();
    };
    
    window.addEventListener('energy-logged', handleEnergyLogged);
    return () => {
      window.removeEventListener('energy-logged', handleEnergyLogged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const loadPatterns = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await energyService.getPatterns(days);

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
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-yellow-600/5 to-orange-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Energy Patterns</h3>
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
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-yellow-600/5 to-orange-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Energy Patterns</h3>
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

  const typedPatterns = patterns as { timeOfDay?: Record<string, number>; averageByContext?: Array<{ context: string; averageRating: number; count: number }> };
  const timeOfDay = typedPatterns.timeOfDay || {};
  const averageByContext = typedPatterns.averageByContext || [];

  // Prepare data for charts
  const timeOfDayData = Object.entries(timeOfDay).map(([period, value]) => ({
    period: period.charAt(0).toUpperCase() + period.slice(1),
    value: value.toFixed(1),
    color: COLORS[period as keyof typeof COLORS] || "#fbbf24",
  }));

  const contextData = averageByContext.slice(0, 6).map((item) => ({
    name: item.context.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
    value: parseFloat(item.averageRating.toFixed(1)),
    count: item.count,
  }));

  // Radar chart data
  const radarData = [
    {
      subject: "Morning",
      energy: parseFloat(timeOfDay.morning?.toFixed(1) || "0"),
      fullMark: 10,
    },
    {
      subject: "Afternoon",
      energy: parseFloat(timeOfDay.afternoon?.toFixed(1) || "0"),
      fullMark: 10,
    },
    {
      subject: "Evening",
      energy: parseFloat(timeOfDay.evening?.toFixed(1) || "0"),
      fullMark: 10,
    },
    {
      subject: "Night",
      energy: parseFloat(timeOfDay.night?.toFixed(1) || "0"),
      fullMark: 10,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-yellow-600/5 to-orange-600/5" />
      <div className="relative p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Energy Patterns ({days} days)</h3>
        </div>

        {/* Time of Day Patterns - Enhanced Cards */}
        {Object.keys(timeOfDay).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Time of Day Patterns
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {timeOfDayData.map((item, index) => (
                <motion.div
                  key={item.period}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-emerald-500/10 p-4 hover:border-emerald-500/30 transition-all group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <p className="text-xs text-slate-400 mb-2">{item.period}</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                      {item.value}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">/10 average</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Radar Chart */}
            {radarData.some((d) => d.energy > 0) && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-white mb-4">Energy Distribution (Radar)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#ffffff20" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <Radar
                      name="Energy"
                      dataKey="energy"
                      stroke="#fbbf24"
                      fill="#fbbf24"
                      fillOpacity={0.6}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #10b981",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Bar Chart */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white mb-4">Time of Day Comparison</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timeOfDayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="period" stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <YAxis domain={[0, 10]} stroke="#9ca3af" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #10b981",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: unknown) => [`${value}/10`, "Energy"]}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {timeOfDayData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Energy by Context */}
        {averageByContext.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Energy by Context
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* List View */}
              <div className="space-y-2">
                {averageByContext.slice(0, 5).map((item, index: number) => (
                  <motion.div
                    key={item.context}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-slate-800/50 to-slate-800/30 border border-emerald-500/10 hover:border-emerald-500/30 transition-all"
                  >
                    <span className="text-sm text-white capitalize">
                      {item.context.replace(/-/g, " ")}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">({item.count}x)</span>
                      <span className="text-sm font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        {item.averageRating.toFixed(1)}/10
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pie Chart */}
              {contextData.length > 0 && (
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={contextData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {contextData.map((entry: { name: string; value: number }, index: number) => (
                          <Cell key={`cell-${index}`} fill={RADAR_COLORS[index % RADAR_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "1px solid #10b981",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
