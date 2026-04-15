'use client';

import { isToday, isYesterday, format, isSameYear } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateSeparatorProps {
  date: Date | string;
  className?: string;
}

export function DateSeparator({ date, className }: DateSeparatorProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  let label: string;
  if (isToday(dateObj)) {
    label = 'Today';
  } else if (isYesterday(dateObj)) {
    label = 'Yesterday';
  } else if (isSameYear(dateObj, new Date())) {
    label = format(dateObj, 'MMMM d');
  } else {
    label = format(dateObj, 'MMMM d, yyyy');
  }

  return (
    <div className={cn('flex items-center justify-center py-3 px-6', className)}>
      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-white/8 px-3 py-1 rounded-lg shadow-sm border border-slate-100 dark:border-white/5">
        {label}
      </span>
    </div>
  );
}
