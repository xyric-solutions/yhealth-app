/**
 * @file useApiMutation hook tests
 */

import { renderHook, act } from '@testing-library/react';
import { useApiMutation } from '@/hooks/use-api-mutation';
import api from '@/lib/api-client';

// Mock the api client
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
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

describe('useApiMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start with initial state', () => {
    const { result } = renderHook(() => useApiMutation());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should execute POST mutation successfully', async () => {
    const mockData = { id: 1, created: true };
    (api.post as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useApiMutation());

    await act(async () => {
      await result.current.mutate('/test', { name: 'Test' });
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(mockData);
    expect(api.post).toHaveBeenCalledWith('/test', { name: 'Test' });
  });

  it('should execute PATCH mutation when method is PATCH', async () => {
    const mockData = { id: 1, updated: true };
    (api.patch as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() =>
      useApiMutation({ method: 'PATCH' })
    );

    await act(async () => {
      await result.current.mutate('/test/1', { name: 'Updated' });
    });

    expect(result.current.data).toEqual(mockData);
    expect(api.patch).toHaveBeenCalledWith('/test/1', { name: 'Updated' });
  });

  it('should execute DELETE mutation when method is DELETE', async () => {
    (api.delete as jest.Mock).mockResolvedValue({
      success: true,
      data: null,
    });

    const { result } = renderHook(() =>
      useApiMutation({ method: 'DELETE' })
    );

    await act(async () => {
      await result.current.mutate('/test/1');
    });

    expect(api.delete).toHaveBeenCalledWith('/test/1', undefined);
  });

  it('should handle mutation error', async () => {
    const { ApiError } = jest.requireMock('@/lib/api-client');
    (api.post as jest.Mock).mockRejectedValue(
      new ApiError('Bad request', 400, 'BAD_REQUEST')
    );

    const { result } = renderHook(() => useApiMutation());

    await act(async () => {
      await result.current.mutate('/test', {});
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error?.code).toBe('BAD_REQUEST');
    expect(result.current.data).toBeNull();
  });

  it('should call onSuccess callback', async () => {
    const mockData = { id: 1 };
    const onSuccess = jest.fn();
    (api.post as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() =>
      useApiMutation({ onSuccess })
    );

    await act(async () => {
      await result.current.mutate('/test', { name: 'Test' });
    });

    expect(onSuccess).toHaveBeenCalledWith(mockData, { name: 'Test' });
  });

  it('should call onError callback', async () => {
    const { ApiError } = jest.requireMock('@/lib/api-client');
    const onError = jest.fn();
    (api.post as jest.Mock).mockRejectedValue(
      new ApiError('Error', 500, 'SERVER_ERROR')
    );

    const { result } = renderHook(() =>
      useApiMutation({ onError })
    );

    await act(async () => {
      await result.current.mutate('/test', { name: 'Test' });
    });

    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][1]).toEqual({ name: 'Test' });
  });

  it('should call onSettled callback on success', async () => {
    const mockData = { id: 1 };
    const onSettled = jest.fn();
    (api.post as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() =>
      useApiMutation({ onSettled })
    );

    await act(async () => {
      await result.current.mutate('/test', { name: 'Test' });
    });

    expect(onSettled).toHaveBeenCalledWith(mockData, null, { name: 'Test' });
  });

  it('should call onSettled callback on error', async () => {
    const { ApiError } = jest.requireMock('@/lib/api-client');
    const onSettled = jest.fn();
    const error = new ApiError('Error', 500, 'SERVER_ERROR');
    (api.post as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useApiMutation({ onSettled })
    );

    await act(async () => {
      await result.current.mutate('/test', { name: 'Test' });
    });

    expect(onSettled).toHaveBeenCalledWith(null, error, { name: 'Test' });
  });

  it('should transform data when transform option provided', async () => {
    const mockData = { id: 1, name: 'test' };
    const transform = (data: typeof mockData) => ({
      ...data,
      name: data.name.toUpperCase(),
    });

    (api.post as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() =>
      useApiMutation({ transform })
    );

    await act(async () => {
      await result.current.mutate('/test', {});
    });

    expect(result.current.data?.name).toBe('TEST');
  });

  it('should throw error with mutateAsync', async () => {
    const { ApiError } = jest.requireMock('@/lib/api-client');
    (api.post as jest.Mock).mockRejectedValue(
      new ApiError('Error', 500, 'SERVER_ERROR')
    );

    const { result } = renderHook(() => useApiMutation());

    await expect(
      act(async () => {
        await result.current.mutateAsync('/test', {});
      })
    ).rejects.toThrow('Error');
  });

  it('should reset state when reset is called', async () => {
    const mockData = { id: 1 };
    (api.post as jest.Mock).mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() => useApiMutation());

    await act(async () => {
      await result.current.mutate('/test', {});
    });

    expect(result.current.data).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('should set isLoading during mutation', async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (api.post as jest.Mock).mockReturnValue(promise);

    const { result } = renderHook(() => useApiMutation());

    act(() => {
      result.current.mutate('/test', {});
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!({ success: true, data: {} });
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });
});
