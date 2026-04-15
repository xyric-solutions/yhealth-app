'use client';

import { useState, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';

/**
 * Hook for API mutations (POST, PUT, PATCH, DELETE)
 * Handles loading, error, and success states automatically
 */
export interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: ApiError, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: ApiError | undefined, variables: TVariables) => void;
}

export interface UseMutationReturn<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: string | null;
  data: TData | null;
  reset: () => void;
}

export function useApiMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<{ success: boolean; data?: TData }>,
  options?: UseMutationOptions<TData, TVariables>
): UseMutationReturn<TData, TVariables> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TData | null>(null);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await mutationFn(variables);

        if (response.success && response.data) {
          setData(response.data);
          options?.onSuccess?.(response.data, variables);
          options?.onSettled?.(response.data, undefined, variables);
          return response.data;
        }

        throw new ApiError('Operation failed', 500, 'UNKNOWN_ERROR');
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError(
          err instanceof Error ? err.message : 'Unknown error',
          500,
          'UNKNOWN_ERROR'
        );
        setError(apiError.message);
        options?.onError?.(apiError, variables);
        options?.onSettled?.(undefined, apiError, variables);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options]
  );

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      try {
        return await mutateAsync(variables);
      } catch {
        return undefined;
      }
    },
    [mutateAsync]
  );

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    data,
    reset,
  };
}

/**
 * Pre-configured mutation hooks for common HTTP methods
 */
export function usePost<TData, TBody = unknown>(
  endpoint: string,
  options?: UseMutationOptions<TData, TBody>
) {
  return useApiMutation<TData, TBody>(
    (body) => api.post<TData>(endpoint, body),
    options
  );
}

export function usePatch<TData, TBody = unknown>(
  endpoint: string,
  options?: UseMutationOptions<TData, TBody>
) {
  return useApiMutation<TData, TBody>(
    (body) => api.patch<TData>(endpoint, body),
    options
  );
}

export function useDelete<TData>(
  endpoint: string,
  options?: UseMutationOptions<TData, void>
) {
  return useApiMutation<TData, void>(
    () => api.delete<TData>(endpoint),
    options
  );
}
