"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { motion } from "framer-motion";
import { fadeSlideUp } from "../../lib/motion";

interface TrendLineChartProps {
  data: Array<{ month: string; income: number; expense: number; net: number }>;
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p: any) => p.dataKey === "income")?.value || 0;
  const expense = payload.find((p: any) => p.dataKey === "expense")?.value || 0;
  const net = income - expense;

  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md min-w-[160px]">
      <p className="text-xs text-slate-400 font-medium mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Income</span>
          <span className="text-emerald-400 font-mono">${income.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Expenses</span>
          <span className="text-rose-400 font-mono">${expense.toLocaleString()}</span>
        </div>
        <div className="border-t border-white/5 pt-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-400">Net</span>
          <span className={`font-mono font-medium ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {net >= 0 ? "+" : ""}${net.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TrendLineChart({ data, height = 260 }: TrendLineChartProps) {
  const [period, setPeriod] = useState<"3M" | "6M" | "1Y">("6M");

  const sliced = period === "3M" ? data.slice(-3) : period === "1Y" ? data : data.slice(-6);
  const chartData = sliced.map(d => ({
    ...d,
    name: new Date(d.month + "-01").toLocaleDateString("en", { month: "short" }),
  }));

  return (
    <motion.div variants={fadeSlideUp}>
      {/* Period Switcher */}
      <div className="flex items-center gap-1 mb-4 p-0.5 bg-white/5 rounded-lg w-fit">
        {(["3M", "6M", "1Y"] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              period === p ? "bg-emerald-500/15 text-emerald-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "DM Sans" }}
            axisLine={{ stroke: "#1e293b" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#334155", strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#059669"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#059669", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#059669", stroke: "#05966930", strokeWidth: 4 }}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="#f43f5e"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#f43f5e", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#f43f5e", stroke: "#f43f5e30", strokeWidth: 4 }}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="#0284c7"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            animationDuration={1400}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
