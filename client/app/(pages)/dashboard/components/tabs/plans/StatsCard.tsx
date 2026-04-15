'use client';

interface StatsCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function StatsCard({ label, value, icon, color, bgColor }: StatsCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center ${color}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
