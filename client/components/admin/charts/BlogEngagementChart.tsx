'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';

interface BlogEngagementChartProps {
  data: Array<{ date: string; views: number }>;
  isLoading?: boolean;
}

const tooltipContentStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#fff',
};

export function BlogEngagementChart({ data, isLoading }: BlogEngagementChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[280px] text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-400"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] text-slate-400 gap-2">
        <FileText className="w-12 h-12 opacity-50" />
        <p className="text-sm">No blog data for this period</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          formatter={(value: number | undefined) => [value ?? 0, 'Views']}
        />
        <Bar dataKey="views" fill="#ec4899" radius={[6, 6, 0, 0]} name="Blog Views" />
      </BarChart>
    </ResponsiveContainer>
  );
}

