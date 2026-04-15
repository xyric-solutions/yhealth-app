'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';

type SubscriptionAccessContextValue = ReturnType<typeof useSubscriptionAccess>;

const SubscriptionAccessContext = createContext<SubscriptionAccessContextValue | undefined>(undefined);

export function SubscriptionAccessProvider({ children }: { children: ReactNode }) {
  const value = useSubscriptionAccess();
  return (
    <SubscriptionAccessContext.Provider value={value}>
      {children}
    </SubscriptionAccessContext.Provider>
  );
}

export function useSubscriptionAccessContext(): SubscriptionAccessContextValue {
  const ctx = useContext(SubscriptionAccessContext);
  if (ctx === undefined) {
    throw new Error('useSubscriptionAccessContext must be used within SubscriptionAccessProvider');
  }
  return ctx;
}

/** Use when optional (e.g. layout used outside dashboard). Returns hasAccess: true when outside provider. */
export function useSubscriptionAccessOptional(): SubscriptionAccessContextValue | { hasAccess: true; isSubscribed: true; isTrial: false; isExpired: false; isLoading: false; error: false; refetch: () => Promise<void> } {
  const ctx = useContext(SubscriptionAccessContext);
  if (ctx === undefined) {
    return {
      hasAccess: true,
      isSubscribed: true,
      isTrial: false,
      isExpired: false,
      trialEndsAt: null,
      daysLeftInTrial: 0,
      isLoading: false,
      error: false,
      refetch: async () => {},
    };
  }
  return ctx;
}
