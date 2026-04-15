'use client';

import { useState, useCallback } from 'react';

/**
 * Generic async state management hook
 * Reduces boilerplate for loading/error/data patterns
 */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseAsyncStateReturn<T> extends AsyncState<T> {
  setData: (data: T | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  execute: <R>(
    asyncFn: () => Promise<R>,
    options?: {
      onSuccess?: (result: R) => void;
      onError?: (error: Error) => void;
    }
  ) => Promise<R | undefined>;
}

export function useAsyncState<T>(
  initialData: T | null = null
): UseAsyncStateReturn<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  const execute = useCallback(
    async <R>(
      asyncFn: () => Promise<R>,
      options?: {
        onSuccess?: (result: R) => void;
        onError?: (error: Error) => void;
      }
    ): Promise<R | undefined> => {
      setLoading(true);
      setError(null);

      try {
        const result = await asyncFn();
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
        options?.onError?.(err instanceof Error ? err : new Error(errorMessage));
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    data,
    isLoading,
    error,
    setData,
    setLoading,
    setError,
    reset,
    execute,
  };
}
