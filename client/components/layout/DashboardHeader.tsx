'use client';

import { useState } from 'react';
import { Bell, AlarmClock, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function DashboardHeader() {
  const { user } = useAuth();
  const [greeting] = useState(() => getGreeting());
  const [date] = useState(() => getFormattedDate());

  const firstName = user?.firstName || 'there';

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]"
      style={{
        background: 'rgba(2,2,9,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Left — Greeting + Date */}
      <div>
        <h1 className="text-sm sm:text-base md:text-lg font-semibold text-white leading-tight">
          {greeting},{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">
            {firstName}
          </span>
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{date}</p>
      </div>

      {/* Right — Action buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link
          href="/notifications"
          className="relative p-2 sm:p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </Link>

        <button
          className="p-2 sm:p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          aria-label="Alarms"
        >
          <AlarmClock className="w-4 h-4" />
        </button>

        <Link
          href="/settings"
          className="p-2 sm:p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
