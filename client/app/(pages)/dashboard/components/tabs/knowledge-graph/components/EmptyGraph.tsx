'use client';

import { Network, Dumbbell, Utensils, Moon, Heart } from 'lucide-react';

export function EmptyGraph() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10">
          <Network className="w-10 h-10 text-emerald-400" />
        </div>
        {/* Orbiting icons */}
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
          <Dumbbell className="w-3.5 h-3.5 text-red-400" />
        </div>
        <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
          <Utensils className="w-3.5 h-3.5 text-green-400" />
        </div>
        <div className="absolute -bottom-2 -right-4 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
          <Moon className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="absolute -top-2 -left-4 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
          <Heart className="w-3.5 h-3.5 text-purple-400" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        Your Knowledge Graph Awaits
      </h3>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        Start logging your workouts, meals, mood, and other health data to see how everything connects.
        The graph grows richer as you add more data.
      </p>

      <div className="grid grid-cols-2 gap-3 max-w-sm w-full">
        {[
          { icon: Dumbbell, label: 'Log a workout', color: 'text-red-400' },
          { icon: Utensils, label: 'Track a meal', color: 'text-green-400' },
          { icon: Moon, label: 'Check in on sleep', color: 'text-blue-400' },
          { icon: Heart, label: 'Record your mood', color: 'text-purple-400' },
        ].map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/5 text-sm text-slate-300"
          >
            <Icon className={`w-4 h-4 ${color} shrink-0`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
