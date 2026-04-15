'use client';

import { useWeather } from '@/hooks/use-weather';

export function WeatherWidget() {
  const { weather, isLoading } = useWeather();

  if (isLoading) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] animate-pulse">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
        <div className="w-16 h-4 rounded bg-white/[0.06]" />
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03]">
      {/* Weather icon */}
      <img
        src={weather.iconPath}
        alt={weather.condition}
        className="w-8 h-8 object-contain"
      />

      {/* Condition + temperature */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 hidden md:inline">{weather.condition}</span>
        <span className="text-lg font-bold text-white tabular-nums">
          {weather.temperature}°
        </span>
      </div>
    </div>
  );
}
