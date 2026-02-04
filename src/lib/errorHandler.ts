import { toast } from 'sonner';

/**
 * Executes an async function without blocking, logging errors to console.
 * Use for non-critical operations like notifications, activity logging, etc.
 *
 * @param promise - The promise to execute
 * @param action - Description of the action for error logging
 *
 * @example
 * fireAndForget(notificationService.queueNewSignup(data), 'queue new signup notification');
 */
export function fireAndForget(promise: Promise<unknown>, action: string): void {
  promise.catch((e) => console.error(`Failed to ${action}:`, e));
}

export interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  public code?: string;
  public userMessage?: string;

  constructor(message: string, code?: string, userMessage?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

export class NetworkError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, 'NETWORK_ERROR', userMessage || 'Network connection failed');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, 'VALIDATION_ERROR', userMessage || 'Invalid input provided');
  }
}

export class AuthError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, 'AUTH_ERROR', userMessage || 'Authentication failed');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, 'DATABASE_ERROR', userMessage || 'Database operation failed');
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof AppError && error.userMessage) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    // Common error patterns
    if (error.message.includes('fetch')) {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (error.message.includes('auth')) {
      return 'Please sign in to continue.';
    }
    if (error.message.includes('not found')) {
      return 'The requested item could not be found.';
    }
  }

  return 'Something went wrong. Please try again.';
}

/**
 * Type for Supabase query results with data and error.
 */
interface SupabaseResult<T> {
  data: T;
  error: unknown;
}

/**
 * Throws a converted AppError if the Supabase result contains an error.
 * Use this instead of `if (error) throw error` for consistent error handling.
 *
 * @param result - Supabase query result with data and error properties
 * @returns The data if no error
 * @throws AppError converted from Supabase error
 *
 * @example
 * const { data, error } = await supabase.from('events').select('*');
 * return throwIfSupabaseError({ data, error });
 */
export function throwIfSupabaseError<T>(result: SupabaseResult<T>): T {
  if (result.error) {
    throw errorHandler.fromSupabaseError(result.error);
  }
  return result.data;
}

/**
 * Ensures data exists after a database operation, throwing if null/undefined.
 * Use this instead of `if (!data) throw new Error('Failed to X')` for consistent error messages.
 *
 * @param data - The data to check
 * @param operation - Description of the operation (e.g., "create event", "update participant")
 * @returns The data if it exists
 * @throws DatabaseError if data is null or undefined
 *
 * @example
 * const { data, error } = await supabase.from('events').insert(event).select().single();
 * throwIfSupabaseError({ data, error });
 * return requireData(data, 'create event');
 */
export function requireData<T>(data: T | null | undefined, operation: string): T {
  if (data === null || data === undefined) {
    throw new DatabaseError(
      `Operation '${operation}' returned no data`,
      `Failed to ${operation}. Please try again.`
    );
  }
  return data;
}

export const errorHandler = {
  /**
   * Handle and log errors with optional user notification
   */
  handle(error: unknown, context?: ErrorContext, showToast: boolean = true): void {
    const errorMessage = getErrorMessage(error);
    const userMessage = getUserFriendlyMessage(error);

    // Log the error
    console.error('Error handled:', {
      error: errorMessage,
      context,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Show toast notification to user
    if (showToast) {
      toast.error(userMessage);
    }

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Send to error tracking service (e.g., Sentry)
      // Sentry.captureException(error, { extra: context });
    }
  },

  /**
   * Handle errors specifically for async operations
   */
  async handleAsync<T>(
    operation: () => Promise<T>,
    context?: ErrorContext,
    fallbackValue?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.handle(error, context);
      return fallbackValue;
    }
  },

  /**
   * Create error from Supabase error
   */
  fromSupabaseError(error: unknown): AppError {
    const err = error as { code?: string; message?: string };

    if (err?.code === 'PGRST116') {
      return new DatabaseError(err.message || 'Database error', 'No data found');
    }
    if (err?.code?.startsWith('23')) {
      return new DatabaseError(err.message || 'Database error', 'Data constraint violation');
    }
    if (err?.message?.includes('JWT')) {
      return new AuthError(err.message || 'Auth error', 'Please sign in again');
    }

    return new DatabaseError(err?.message || 'Database error');
  },

  /**
   * Show success toast
   */
  success(message: string): void {
    toast.success(message);
  },

  /**
   * Show info toast
   */
  info(message: string): void {
    toast.info(message);
  },
};
