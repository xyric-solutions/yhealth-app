'use client';

import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read';
  className?: string;
}

export function MessageStatus({ status, className }: MessageStatusProps) {
  if (status === 'sending') {
    return null;
  }

  if (status === 'read') {
    return (
      <CheckCheck className={cn('h-[13px] w-[13px] text-emerald-500 dark:text-emerald-400 shrink-0', className)} />
    );
  }

  if (status === 'delivered') {
    return (
      <CheckCheck className={cn('h-[13px] w-[13px] text-white/80 shrink-0', className)} />
    );
  }

  return (
    <Check className={cn('h-[13px] w-[13px] text-white/80 shrink-0', className)} />
  );
}

