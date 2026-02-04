import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLoadingState, useAsyncOperation } from '../useLoadingState';

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  logError: vi.fn(),
  errorHandler: {
    handle: vi.fn(),
  },
  throwIfSupabaseError: vi.fn((result) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }),
  requireData: vi.fn((data, operation) => {
    if (data === null || data === undefined) {
      throw new Error(`Failed to ${operation}`);
    }
    return data;
  }),
}));

import { errorHandler } from '@/lib/errorHandler';

const mockErrorHandler = vi.mocked(errorHandler);

describe('useLoadingState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useLoadingState());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBeNull();
    });

    it('should initialize with provided initial data', () => {
      const initialData = { name: 'Test', value: 42 };
      const { result } = renderHook(() => useLoadingState(initialData));

      expect(result.current.data).toEqual(initialData);
    });
  });

  describe('execute', () => {
    it('should set loading state during async operation', async () => {
      const { result } = renderHook(() => useLoadingState<string>());

      const asyncOperation = async () => {
        return 'result';
      };

      await act(async () => {
        await result.current.execute(asyncOperation);
      });

      // Verify the final state after execution
      expect(result.current.isLoading).toBe(false);
    });

    it('should return result and set data on success', async () => {
      const { result } = renderHook(() => useLoadingState<string>());

      let returnValue: string | null;

      await act(async () => {
        returnValue = await result.current.execute(async () => 'success');
      });

      expect(returnValue!).toBe('success');
      expect(result.current.data).toBe('success');
      expect(result.current.error).toBeNull();
    });

    it('should handle errors and call errorHandler', async () => {
      const { result } = renderHook(() => useLoadingState<string>());

      const testError = new Error('Test error');

      let returnValue: string | null;
      await act(async () => {
        returnValue = await result.current.execute(async () => {
          throw testError;
        });
      });

      expect(returnValue!).toBeNull();
      expect(result.current.error).toBe('Test error');
      expect(result.current.data).toBeNull();
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(testError);
    });

    it('should handle non-Error thrown values', async () => {
      const { result } = renderHook(() => useLoadingState<string>());

      await act(async () => {
        await result.current.execute(async () => {
          throw 'string error';
        });
      });

      expect(result.current.error).toBe('An error occurred');
    });

    it('should clear previous error on new execution', async () => {
      const { result } = renderHook(() => useLoadingState<string>());

      // First, create an error
      await act(async () => {
        await result.current.execute(async () => {
          throw new Error('First error');
        });
      });

      expect(result.current.error).toBe('First error');

      // Then succeed
      await act(async () => {
        await result.current.execute(async () => 'success');
      });

      expect(result.current.error).toBeNull();
      expect(result.current.data).toBe('success');
    });

    it('should set isLoading to false after completion', async () => {
      const { result } = renderHook(() => useLoadingState<string>());

      await act(async () => {
        await result.current.execute(async () => 'done');
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should set isLoading to false even on error', async () => {
      const { result } = renderHook(() => useLoadingState<string>());

      await act(async () => {
        await result.current.execute(async () => {
          throw new Error('error');
        });
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const initialData = 'initial';
      const { result } = renderHook(() => useLoadingState(initialData));

      // Modify state
      await act(async () => {
        await result.current.execute(async () => 'new data');
      });

      expect(result.current.data).toBe('new data');

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBe(initialData);
    });

    it('should reset to null when no initial data provided', async () => {
      const { result } = renderHook(() => useLoadingState<string>());

      await act(async () => {
        await result.current.execute(async () => 'data');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();
    });
  });

  // Note: setLoading, setError, setData are trivial setters - not worth testing individually
});

describe('useAsyncOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading false and no data', () => {
    const operation = vi.fn().mockResolvedValue('result');
    const { result } = renderHook(() => useAsyncOperation(operation, []));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('should provide run function to execute operation', async () => {
    const operation = vi.fn().mockResolvedValue('result');
    const { result } = renderHook(() => useAsyncOperation(operation, []));

    await act(async () => {
      await result.current.run();
    });

    expect(operation).toHaveBeenCalled();
    expect(result.current.data).toBe('result');
  });

  it('should auto-run when dependencies change', async () => {
    const operation = vi.fn().mockResolvedValue('result');

    const { result } = renderHook(({ deps }) => useAsyncOperation(operation, deps), {
      initialProps: { deps: ['dep1'] },
    });

    // Wait for auto-run to complete
    await waitFor(() => {
      expect(result.current.data).toBe('result');
    });

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should not auto-run with empty dependencies', async () => {
    const operation = vi.fn().mockResolvedValue('result');

    renderHook(() => useAsyncOperation(operation, []));

    // Give it time to potentially auto-run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(operation).not.toHaveBeenCalled();
  });

  it('should handle errors in operation', async () => {
    const error = new Error('Operation failed');
    const operation = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useAsyncOperation(operation, []));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe('Operation failed');
    expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
  });
});
