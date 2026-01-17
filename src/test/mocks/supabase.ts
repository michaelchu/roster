import { vi } from 'vitest';

/**
 * Creates a chainable mock for Supabase query builders.
 * Use this when you need to mock specific responses.
 *
 * @example
 * const chain = createQueryChain({ data: [{ id: '1' }], error: null });
 * mockSupabase.from.mockReturnValue(chain);
 */
export function createQueryChain(finalResult: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
    single: vi.fn().mockResolvedValue(finalResult),
    // For terminal calls that don't use single()
    then: vi.fn((resolve) => resolve(finalResult)),
  };

  // Make order/eq/etc return the chain but also be thenable
  Object.assign(chain.order, { then: vi.fn((resolve) => resolve(finalResult)) });
  Object.assign(chain.eq, { then: vi.fn((resolve) => resolve(finalResult)) });

  return chain;
}

/**
 * Default mock Supabase client with basic chaining support.
 * Import and use with vi.mocked() to set specific return values.
 */
export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithIdToken: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  })),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      download: vi.fn(),
      remove: vi.fn(),
      getPublicUrl: vi.fn(),
    })),
  },
};

/**
 * Creates a mock useAuth return value.
 * @param overrides - Partial overrides for the auth state
 */
export function createMockAuthValue(
  overrides: Partial<{
    user: { id: string; email: string } | null;
    session: unknown;
    loading: boolean;
  }> = {}
) {
  return {
    user: null,
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signInWithGoogleIdToken: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates an authenticated mock user for tests.
 */
export function createMockUser(
  overrides: Partial<{
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  }> = {}
) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: { full_name: 'Test User', ...overrides.user_metadata },
    aud: 'authenticated',
    created_at: '2023-01-01T00:00:00Z',
    ...overrides,
  };
}
