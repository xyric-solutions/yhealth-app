'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CreditCard } from 'lucide-react';

interface PlanDistributionPieChartProps {
  data: Array<{ name: string; value: number; revenue: number }>;
  isLoading?: boolean;
}

const COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const tooltipContentStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#fff',
};

export function PlanDistributionPieChart({ data, isLoading }: PlanDistributionPieChartProps) {
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
        <CreditCard className="w-12 h-12 opacity-50" />
        <p className="text-sm">No subscription plan data</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value: number | undefined, name: string | undefined, _props: unknown) => {
            if (name === 'value') {
              return [`${value ?? 0} subscriptions`, 'Count'];
            }
            return [value ?? 0, name ?? ''];
          }}
        />
        <Legend
          formatter={(value, _entry: unknown) => {
            const dataEntry = data.find((d) => d.name === value);
            return `${value} (${dataEntry?.value || 0})`;
          }}
          wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

