import { toast } from '@/hooks/use-toast';

export interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  public code?: string;
  public userMessage?: string;

  constructor(
    message: string,
    code?: string,
    userMessage?: string
  ) {
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: userMessage,
      });
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
    toast({
      title: 'Success',
      description: message,
    });
  },

  /**
   * Show info toast
   */
  info(message: string): void {
    toast({
      title: 'Info',
      description: message,
    });
  },
};