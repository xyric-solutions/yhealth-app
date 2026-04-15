'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Users } from 'lucide-react';

interface UserGrowthLineChartProps {
  data: Array<{ date: string; count: number }>;
  isLoading?: boolean;
}

const tooltipContentStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#fff',
};

export function UserGrowthLineChart({ data, isLoading }: UserGrowthLineChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[280px] text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] text-slate-400 gap-2">
        <Users className="w-12 h-12 opacity-50" />
        <p className="text-sm">No user data for this period</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          formatter={(value: number | undefined) => [value ?? 0, 'Users']}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#38bdf8"
          strokeWidth={2}
          dot={{ fill: '#38bdf8', r: 3 }}
          name="Users"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

