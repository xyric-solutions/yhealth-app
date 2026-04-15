/**
 * @file useFetch hook tests
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useFetch } from '@/hooks/use-fetch';
import api from '@/lib/api-client';

// Mock the api client
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public code: string
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

describe('useFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start with loading state when immediate is true', () => {
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 1 },
    });

    const { result } = renderHook(() => useFetch('/test'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when immediate is false', () => {
    const { result } = renderHook(() =>
      useFetch('/test', { immediate: false })
    );

    expect(result.current.isLoading).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('should fetch data successfully', async () => {
    const mockData = { id: 1, name: 'Test' };
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useFetch('/test'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(result.current.isFetched).toBe(true);
  });

  it('should handle error response', async () => {
    const { ApiError } = jest.requireMock('@/lib/api-client');
    (api.get as jest.Mock).mockRejectedValue(
      new ApiError('Not found', 404, 'NOT_FOUND')
    );

    const { result } = renderHook(() => useFetch('/test'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.code).toBe('NOT_FOUND');
  });

  it('should call onSuccess callback', async () => {
    const mockData = { id: 1 };
    const onSuccess = jest.fn();
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    renderHook(() => useFetch('/test', { onSuccess }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  it('should call onError callback', async () => {
    const { ApiError } = jest.requireMock('@/lib/api-client');
    const onError = jest.fn();
    (api.get as jest.Mock).mockRejectedValue(
      new ApiError('Error', 500, 'SERVER_ERROR')
    );

    renderHook(() => useFetch('/test', { onError }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it('should transform data when transform option provided', async () => {
    const mockData = { id: 1, name: 'test' };
    const transform = (data: typeof mockData) => ({
      ...data,
      name: data.name.toUpperCase(),
    });

    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() =>
      useFetch('/test', { transform })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.name).toBe('TEST');
  });

  it('should refetch data when refetch is called', async () => {
    const mockData = { id: 1 };
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useFetch('/test'));

    await waitFor(() => {
      expect(result.current.isFetched).toBe(true);
    });

    expect(api.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('should reset state when reset is called', async () => {
    const mockData = { id: 1 };
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useFetch('/test'));

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isFetched).toBe(false);
  });

  it('should not fetch when endpoint is null', () => {
    const { result } = renderHook(() => useFetch(null));

    expect(result.current.isLoading).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('should include pagination meta when available', async () => {
    const mockData = [{ id: 1 }, { id: 2 }];
    const mockMeta = {
      page: 1,
      limit: 10,
      total: 100,
      totalPages: 10,
      hasNextPage: true,
      hasPrevPage: false,
    };

    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
      meta: mockMeta,
    });

    const { result } = renderHook(() => useFetch('/test'));

    await waitFor(() => {
      expect(result.current.meta).not.toBeNull();
    });

    expect(result.current.meta).toEqual(mockMeta);
  });
});
