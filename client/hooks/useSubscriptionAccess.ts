'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { api } from '@/lib/api-client';

export interface SubscriptionAccessState {
  hasAccess: boolean;
  isSubscribed: boolean;
  isTrial: boolean;
  isExpired: boolean;
  trialEndsAt: string | null;
  daysLeftInTrial: number;
  isLoading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
}

export function useSubscriptionAccess(): SubscriptionAccessState {
  const { isAuthenticated, user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [daysLeftInTrial, setDaysLeftInTrial] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAccess = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setHasAccess(false);
      setIsTrial(false);
      setTrialEndsAt(null);
      setDaysLeftInTrial(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(false);
    try {
      const res = await api.get<{
        subscription: unknown;
        access: {
          allowed: boolean;
          reason: string;
          trialEndsAt?: string;
          daysLeftInTrial?: number;
        };
      }>('/subscription/me');
      const data = res.data as typeof res.data & { access?: { allowed: boolean; reason: string; trialEndsAt?: string; daysLeftInTrial?: number } };
      const access = data?.access;
      if (!access) {
        // Missing access field — grant access by default (don't lock out on malformed response)
        setHasAccess(true);
        setIsTrial(false);
        setTrialEndsAt(null);
        setDaysLeftInTrial(0);
        setIsLoading(false);
        return;
      }
      setHasAccess(!!access.allowed);
      setIsTrial(access.reason === 'trial');
      setTrialEndsAt(access.trialEndsAt ?? null);
      setDaysLeftInTrial(access.daysLeftInTrial ?? 0);
    } catch {
      setError(true);
      // On API error, grant access by default — don't lock users out due to network/auth failures
      setHasAccess(true);
      setIsTrial(false);
      setTrialEndsAt(null);
      setDaysLeftInTrial(0);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  return {
    hasAccess,
    isSubscribed: hasAccess && !isTrial,
    isTrial,
    isExpired: !hasAccess && !isLoading && isAuthenticated && !error,
    trialEndsAt,
    daysLeftInTrial,
    isLoading,
    error,
    refetch: fetchAccess,
  };
}
