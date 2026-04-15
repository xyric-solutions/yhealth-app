"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";
import { fadeSlideUp } from "../../lib/motion";

interface MonthBarChartProps {
  data: Array<{ month: string; income: number; expense: number }>;
  budgetLimit?: number;
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p: any) => p.dataKey === "income")?.value || 0;
  const expense = payload.find((p: any) => p.dataKey === "expense")?.value || 0;

  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-xl p-3 shadow-xl">
      <p className="text-xs text-slate-400 font-medium mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Income</span>
          <span className="text-emerald-400 font-mono">${income.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-rose-500" /> Expenses</span>
          <span className="text-rose-400 font-mono">${expense.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export function MonthBarChart({ data, budgetLimit, height = 220 }: MonthBarChartProps) {
  const chartData = data.map(d => ({
    ...d,
    name: new Date(d.month + "-01").toLocaleDateString("en", { month: "short" }),
  }));

  return (
    <motion.div variants={fadeSlideUp}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} barGap={3} barCategoryGap="20%" margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <CartesianGrid vertical={false} stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#1e293b" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1e293b40" }} />
          <Bar
            dataKey="income"
            fill="#059669"
            radius={[4, 4, 0, 0]}
            animationDuration={800}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="expense"
            fill="#f43f5e"
            fillOpacity={0.7}
            radius={[4, 4, 0, 0]}
            animationDuration={800}
            animationEasing="ease-out"
          />
          {budgetLimit && (
            <ReferenceLine
              y={budgetLimit}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: "Budget", fill: "#f59e0b", fontSize: 10, position: "right" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
