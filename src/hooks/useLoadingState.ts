import { useState, useCallback, useEffect } from 'react';
import { errorHandler } from '@/lib/errorHandler';

export interface LoadingState<T = unknown> {
  isLoading: boolean;
  error: string | null;
  data: T | null;
}

export interface UseLoadingStateResult<T> {
  isLoading: boolean;
  error: string | null;
  data: T | null;
  execute: (asyncFn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setData: (data: T | null) => void;
}

export function useLoadingState<T = unknown>(
  initialData: T | null = null
): UseLoadingStateResult<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(initialData);

  const execute = useCallback(async (asyncFn: () => Promise<T>): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      errorHandler.handle(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(initialData);
  }, [initialData]);

  const setLoadingWrapper = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const setErrorWrapper = useCallback((error: string | null) => {
    setError(error);
  }, []);

  const setDataWrapper = useCallback((data: T | null) => {
    setData(data);
  }, []);

  return {
    isLoading,
    error,
    data,
    execute,
    reset,
    setLoading: setLoadingWrapper,
    setError: setErrorWrapper,
    setData: setDataWrapper,
  };
}

// Hook for managing multiple loading states (useful for forms with multiple actions)
export function useMultipleLoadingStates<T extends Record<string, unknown>>(
  keys: (keyof T)[]
): Record<keyof T, UseLoadingStateResult<unknown>> {
  const states = {} as Record<keyof T, UseLoadingStateResult<unknown>>;

  for (const key of keys) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    states[key] = useLoadingState();
  }

  return states;
}

// Hook for async operations with automatic loading state management
export function useAsyncOperation<T>(
  operation: () => Promise<T>,
  dependencies: unknown[] = []
) {
  const { isLoading, error, data, execute } = useLoadingState<T>();

  const run = useCallback(() => {
    return execute(operation);
  }, [execute, operation]);

  // Auto-run on mount if dependencies are provided
  useEffect(() => {
    if (dependencies.length > 0) {
      run();
    }
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isLoading,
    error,
    data,
    run,
  };
}