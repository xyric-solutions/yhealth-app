/**
 * @file useFetch hook
 * @description Generic fetch hook with loading/error states and caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api, { ApiError } from '@/lib/api-client';
import type { PaginationMeta } from '@shared/types/api';

export interface UseFetchOptions<T> {
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean;
  /** Dependencies that trigger refetch when changed */
  deps?: unknown[];
  /** Transform response data before setting state */
  transform?: (data: T) => T;
  /** Callback when fetch succeeds */
  onSuccess?: (data: T) => void;
  /** Callback when fetch fails */
  onError?: (error: ApiError) => void;
}

export interface UseFetchResult<T> {
  /** The fetched data */
  data: T | null;
  /** Whether the request is in progress */
  isLoading: boolean;
  /** Error object if request failed */
  error: ApiError | null;
  /** Pagination metadata if available */
  meta: PaginationMeta | null;
  /** Manual refetch function */
  refetch: () => Promise<void>;
  /** Reset state to initial values */
  reset: () => void;
  /** Whether data has been fetched at least once */
  isFetched: boolean;
}

// Caching disabled for fresh data on every request

export function useFetch<T>(
  endpoint: string | null,
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const {
    immediate = true,
    deps = [],
    transform,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(immediate && !!endpoint);
  const [error, setError] = useState<ApiError | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isFetched, setIsFetched] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  // Generation counter: prevents stale responses from overwriting current state
  const fetchGenRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!endpoint) {
      setIsLoading(false);
      return;
    }

    // Increment generation so stale responses are ignored
    const gen = ++fetchGenRef.current;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<T>(endpoint, {
        signal: abortControllerRef.current.signal,
      });

      // Ignore stale responses (from previous generation or unmounted component)
      if (!mountedRef.current || gen !== fetchGenRef.current) return;

      if (response.success && response.data !== undefined) {
        const transformedData = transform ? transform(response.data) : response.data;
        setData(transformedData);
        setMeta(response.meta as PaginationMeta ?? null);
        setIsFetched(true);
        onSuccess?.(transformedData);
      } else {
        throw new ApiError(
          response.error?.message || 'Request failed',
          0,
          response.error?.code || 'REQUEST_FAILED'
        );
      }
    } catch (err) {
      // Ignore stale errors
      if (!mountedRef.current || gen !== fetchGenRef.current) return;

      // Check if it's a canceled/aborted request
      const isCanceled = err instanceof ApiError && err.code === 'CANCELED' ||
                        (err instanceof Error && (
                          err.name === 'AbortError' ||
                          err.message === 'canceled' ||
                          err.message.toLowerCase().includes('canceled') ||
                          err.message.toLowerCase().includes('aborted')
                        ));

      // Ignore canceled requests - don't show error to user
      if (isCanceled) {
        return;
      }

      const apiError = err instanceof ApiError
        ? err
        : new ApiError((err as Error).message || 'Unknown error', 0, 'UNKNOWN_ERROR');

      setError(apiError);
      onError?.(apiError);
    } finally {
      if (mountedRef.current && gen === fetchGenRef.current) {
        setIsLoading(false);
      }
    }
  }, [endpoint, transform, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setMeta(null);
    setIsLoading(false);
    setIsFetched(false);
  }, []);

  // Fetch on mount and when deps change
  useEffect(() => {
    mountedRef.current = true;

    if (immediate && endpoint) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, immediate, ...deps]);

  return {
    data,
    isLoading,
    error,
    meta,
    refetch: fetchData,
    reset,
    isFetched,
  };
}

export default useFetch;
