import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth, AuthProvider } from '../useAuth';
import type { ReactNode } from 'react';

// Mock supabase
const mockAuthStateChange = vi.fn();
const mockGetSession = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signInWithPassword: (credentials: { email: string; password: string }) =>
        mockSignInWithPassword(credentials),
      signUp: (credentials: { email: string; password: string }) => mockSignUp(credentials),
      signInWithOAuth: (options: { provider: string; options?: { redirectTo: string } }) =>
        mockSignInWithOAuth(options),
      signOut: () => mockSignOut(),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        mockAuthStateChange(callback);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      },
    },
  },
}));

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSignInWithOAuth.mockResolvedValue({
      data: {},
      error: null,
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );

  it('initializes with loading state', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
    });
  });

  it('loads existing session on mount', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com' },
      access_token: 'token',
    };
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.session).toEqual(mockSession);
    });
  });

  describe('signIn', () => {
    it('signs in user successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('throws error on sign in failure', async () => {
      const error = new Error('Invalid credentials');
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await expect(result.current.signIn('test@example.com', 'wrongpassword')).rejects.toThrow(
          'Invalid credentials'
        );
      });
    });
  });

  describe('signUp', () => {
    it('signs up user successfully', async () => {
      const mockUser = { id: 'user-123', email: 'new@example.com' };
      mockSignUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signUp('new@example.com', 'password123', 'John Doe');
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'John Doe',
          },
        },
      });
    });

    it('throws error on sign up failure', async () => {
      const error = new Error('Email already exists');
      mockSignUp.mockResolvedValue({
        data: null,
        error,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await expect(
          result.current.signUp('existing@example.com', 'password123', 'John Doe')
        ).rejects.toThrow('Email already exists');
      });
    });
  });

  describe('signInWithGoogle', () => {
    it('signs in with Google successfully', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: {},
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    });

    it('throws error on Google sign in failure', async () => {
      const error = new Error('Google OAuth failed');
      mockSignInWithOAuth.mockResolvedValue({
        data: null,
        error,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await expect(result.current.signInWithGoogle()).rejects.toThrow('Google OAuth failed');
      });
    });
  });

  describe('signOut', () => {
    it('signs out user successfully', async () => {
      mockSignOut.mockResolvedValue({
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('throws error on sign out failure', async () => {
      const error = new Error('Sign out failed');
      mockSignOut.mockResolvedValue({
        error,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await expect(result.current.signOut()).rejects.toThrow('Sign out failed');
      });
    });
  });

  describe('auth state changes', () => {
    it('updates user and session on auth state change', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      const newSession = {
        user: { id: 'user-456', email: 'changed@example.com' },
        access_token: 'new-token',
      };

      // Simulate auth state change
      const callback = mockAuthStateChange.mock.calls[0][0];
      act(() => {
        callback('SIGNED_IN', newSession);
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(newSession.user);
        expect(result.current.session).toEqual(newSession);
      });
    });

    it('clears user and session on sign out event', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Simulate sign out
      const callback = mockAuthStateChange.mock.calls[0][0];
      act(() => {
        callback('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(result.current.user).toBe(null);
        expect(result.current.session).toBe(null);
      });
    });
  });

  it('throws error when useAuth is used outside AuthProvider', () => {
    // Temporarily suppress console.error for this test
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    console.error = originalError;
  });
});
