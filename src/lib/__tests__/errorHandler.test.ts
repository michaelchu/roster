import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import { errorHandler, AppError, AuthError, DatabaseError, NetworkError } from '../errorHandler';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockToast = vi.mocked(toast);

// Note: Error class constructor tests removed - they're trivial property assignments.
// The error classes are tested implicitly through errorHandler.handle and fromSupabaseError tests.

describe('errorHandler', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  describe('handle', () => {
    it('should log error to console', () => {
      const error = new Error('Test error');

      errorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedData = consoleErrorSpy.mock.calls[0][1] as { error: string };
      expect(loggedData.error).toBe('Test error');
    });

    it('should include context in log', () => {
      const error = new Error('Test error');
      const context = { userId: 'user-123', action: 'testAction' };

      errorHandler.handle(error, context);

      const loggedData = consoleErrorSpy.mock.calls[0][1] as { context: typeof context };
      expect(loggedData.context).toEqual(context);
    });

    it('should show toast notification by default', () => {
      const error = new Error('Test error');

      errorHandler.handle(error);

      expect(mockToast.error).toHaveBeenCalledWith(expect.any(String));
    });

    it('should not show toast when showToast is false', () => {
      const error = new Error('Test error');

      errorHandler.handle(error, undefined, false);

      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it('should use userMessage from AppError', () => {
      const error = new AppError('Internal error', 'CODE', 'User-friendly message');

      errorHandler.handle(error);

      expect(mockToast.error).toHaveBeenCalledWith('User-friendly message');
    });

    it('should handle string errors', () => {
      errorHandler.handle('String error');

      const loggedData = consoleErrorSpy.mock.calls[0][1] as { error: string };
      expect(loggedData.error).toBe('String error');
    });

    it('should handle unknown error types', () => {
      errorHandler.handle({ weird: 'object' });

      const loggedData = consoleErrorSpy.mock.calls[0][1] as { error: string };
      expect(loggedData.error).toBe('An unknown error occurred');
    });

    it('should provide friendly message for fetch errors', () => {
      const error = new Error('fetch failed');

      errorHandler.handle(error);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Network connection failed. Please check your internet connection.'
      );
    });

    it('should provide friendly message for auth errors', () => {
      const error = new Error('auth token expired');

      errorHandler.handle(error);

      expect(mockToast.error).toHaveBeenCalledWith('Please sign in to continue.');
    });

    it('should provide friendly message for not found errors', () => {
      const error = new Error('Item not found');

      errorHandler.handle(error);

      expect(mockToast.error).toHaveBeenCalledWith('The requested item could not be found.');
    });

    it('should include stack trace in log for Error instances', () => {
      const error = new Error('With stack');

      errorHandler.handle(error);

      const loggedData = consoleErrorSpy.mock.calls[0][1] as { stack?: string };
      expect(loggedData.stack).toBeDefined();
    });
  });

  describe('handleAsync', () => {
    it('should return result on success', async () => {
      const operation = async () => 'success';

      const result = await errorHandler.handleAsync(operation);

      expect(result).toBe('success');
    });

    it('should return fallback value on error', async () => {
      const operation = async () => {
        throw new Error('Failed');
      };

      const result = await errorHandler.handleAsync(operation, undefined, 'fallback');

      expect(result).toBe('fallback');
    });

    it('should return undefined on error with no fallback', async () => {
      const operation = async () => {
        throw new Error('Failed');
      };

      const result = await errorHandler.handleAsync(operation);

      expect(result).toBeUndefined();
    });

    it('should call handle on error', async () => {
      const error = new Error('Async error');
      const operation = async () => {
        throw error;
      };
      const context = { action: 'asyncTest' };

      await errorHandler.handleAsync(operation, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedData = consoleErrorSpy.mock.calls[0][1] as { context: typeof context };
      expect(loggedData.context).toEqual(context);
    });
  });

  describe('fromSupabaseError', () => {
    it('should convert PGRST116 to DatabaseError with "No data found"', () => {
      const supabaseError = { code: 'PGRST116', message: 'Row not found' };

      const result = errorHandler.fromSupabaseError(supabaseError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.userMessage).toBe('No data found');
    });

    it('should convert 23xxx codes to DatabaseError with constraint message', () => {
      const supabaseError = { code: '23505', message: 'Unique violation' };

      const result = errorHandler.fromSupabaseError(supabaseError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.userMessage).toBe('Data constraint violation');
    });

    it('should convert JWT errors to AuthError', () => {
      const supabaseError = { message: 'JWT expired' };

      const result = errorHandler.fromSupabaseError(supabaseError);

      expect(result).toBeInstanceOf(AuthError);
      expect(result.userMessage).toBe('Please sign in again');
    });

    it('should return generic DatabaseError for unknown errors', () => {
      const supabaseError = { code: 'UNKNOWN', message: 'Something else' };

      const result = errorHandler.fromSupabaseError(supabaseError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Something else');
    });

    it('should handle null/undefined error', () => {
      const result = errorHandler.fromSupabaseError(null);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database error');
    });

    it('should convert "Failed to fetch" errors to NetworkError', () => {
      const supabaseError = { message: 'TypeError: Failed to fetch' };

      const result = errorHandler.fromSupabaseError(supabaseError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.userMessage).toBe(
        'Network connection failed. Please check your internet connection.'
      );
    });

    it('should convert NetworkError messages to NetworkError', () => {
      const supabaseError = { message: 'NetworkError when attempting to fetch resource' };

      const result = errorHandler.fromSupabaseError(supabaseError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.userMessage).toBe(
        'Network connection failed. Please check your internet connection.'
      );
    });

    it('should convert "Network request failed" errors to NetworkError', () => {
      const supabaseError = { message: 'Network request failed' };

      const result = errorHandler.fromSupabaseError(supabaseError);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.userMessage).toBe(
        'Network connection failed. Please check your internet connection.'
      );
    });
  });

  describe('success', () => {
    it('should show success toast', () => {
      errorHandler.success('Operation completed');

      expect(mockToast.success).toHaveBeenCalledWith('Operation completed');
    });
  });

  describe('info', () => {
    it('should show info toast', () => {
      errorHandler.info('FYI message');

      expect(mockToast.info).toHaveBeenCalledWith('FYI message');
    });
  });
});
