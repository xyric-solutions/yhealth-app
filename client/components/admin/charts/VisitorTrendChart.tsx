'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';

interface VisitorTrendChartProps {
  data: Array<{ date: string; uniqueVisitors: number }>;
  isLoading?: boolean;
}

const tooltipContentStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#fff',
};

export function VisitorTrendChart({ data, isLoading }: VisitorTrendChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[320px] text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[320px] text-slate-400 gap-2">
        <Eye className="w-12 h-12 opacity-50" />
        <p className="text-sm">No visitor data for this period</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="visitorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis
          dataKey="date"
          stroke="#94a3b8"
          fontSize={12}
          tick={{ fill: '#94a3b8' }}
          tickFormatter={(v) => (v ? format(new Date(v), 'MMM d') : v)}
        />
        <YAxis stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelFormatter={(v) => (v ? format(new Date(v), 'PPP') : v)}
        />
        <Area
          type="monotone"
          dataKey="uniqueVisitors"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#visitorGradient)"
          name="Unique Visitors"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

