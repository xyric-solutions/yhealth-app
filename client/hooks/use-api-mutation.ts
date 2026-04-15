/**
 * @file useApiMutation hook
 * @description Generic mutation hook for POST/PUT/PATCH/DELETE with loading/error states
 */

import { useState, useCallback, useRef } from 'react';
import api, { ApiError, type ApiResponse } from '@/lib/api-client';

type HttpMethod = 'POST' | 'PATCH' | 'DELETE';

export interface UseApiMutationOptions<TData, TVariables> {
  /** HTTP method (default: POST) */
  method?: HttpMethod;
  /** Callback when mutation succeeds */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Callback when mutation fails */
  onError?: (error: ApiError, variables: TVariables) => void;
  /** Callback when mutation settles (success or error) */
  onSettled?: (data: TData | null, error: ApiError | null, variables: TVariables) => void;
  /** Transform response data before returning */
  transform?: (data: TData) => TData;
}

export interface UseApiMutationResult<TData, TVariables> {
  /** Execute the mutation */
  mutate: (endpoint: string, variables?: TVariables) => Promise<TData | null>;
  /** Execute the mutation and throw on error */
  mutateAsync: (endpoint: string, variables?: TVariables) => Promise<TData>;
  /** Response data from last successful mutation */
  data: TData | null;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Whether the mutation succeeded */
  isSuccess: boolean;
  /** Whether the mutation failed */
  isError: boolean;
  /** Error object if mutation failed */
  error: ApiError | null;
  /** Reset state to initial values */
  reset: () => void;
}

export function useApiMutation<TData = unknown, TVariables = unknown>(
  options: UseApiMutationOptions<TData, TVariables> = {}
): UseApiMutationResult<TData, TVariables> {
  const {
    method = 'POST',
    onSuccess,
    onError,
    onSettled,
    transform,
  } = options;

  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mountedRef = useRef(true);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
  }, []);

  const executeMutation = useCallback(
    async (endpoint: string, variables?: TVariables): Promise<TData> => {
      setIsLoading(true);
      setIsSuccess(false);
      setIsError(false);
      setError(null);

      try {
        let response: ApiResponse<TData>;

        switch (method) {
          case 'PATCH':
            response = await api.patch<TData>(endpoint, variables);
            break;
          case 'DELETE':
            response = await api.delete<TData>(endpoint, variables);
            break;
          case 'POST':
          default:
            response = await api.post<TData>(endpoint, variables);
            break;
        }

        if (!mountedRef.current) {
          throw new ApiError('Component unmounted', 0, 'UNMOUNTED');
        }

        if (!response.success) {
          throw new ApiError(
            response.error?.message || 'Request failed',
            0,
            response.error?.code || 'REQUEST_FAILED'
          );
        }

        const responseData = response.data as TData;
        const transformedData = transform ? transform(responseData) : responseData;

        setData(transformedData);
        setIsSuccess(true);
        onSuccess?.(transformedData, variables as TVariables);
        onSettled?.(transformedData, null, variables as TVariables);

        return transformedData;
      } catch (err) {
        if (!mountedRef.current) {
          throw err;
        }

        const apiError = err instanceof ApiError
          ? err
          : new ApiError((err as Error).message || 'Unknown error', 0, 'UNKNOWN_ERROR');

        setError(apiError);
        setIsError(true);
        onError?.(apiError, variables as TVariables);
        onSettled?.(null, apiError, variables as TVariables);

        throw apiError;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [method, transform, onSuccess, onError, onSettled]
  );

  const mutate = useCallback(
    async (endpoint: string, variables?: TVariables): Promise<TData | null> => {
      try {
        return await executeMutation(endpoint, variables);
      } catch {
        return null;
      }
    },
    [executeMutation]
  );

  const mutateAsync = useCallback(
    async (endpoint: string, variables?: TVariables): Promise<TData> => {
      return executeMutation(endpoint, variables);
    },
    [executeMutation]
  );

  // Cleanup on unmount
  useCallback(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    mutate,
    mutateAsync,
    data,
    isLoading,
    isSuccess,
    isError,
    error,
    reset,
  };
}

export default useApiMutation;
