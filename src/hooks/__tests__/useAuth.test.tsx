/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Track auth state change callback
let authStateCallback: ((event: string, session: any) => void) | null = null;
const mockUnsubscribe = vi.fn();

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((callback) => {
        authStateCallback = callback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithIdToken: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// Mock pushSubscriptionService
const mockRemoveSubscriptionFromDatabase = vi.fn();
vi.mock('@/lib/mixpanel', () => ({
  mixpanel: {
    identify: vi.fn(),
    people: { set: vi.fn() },
    reset: vi.fn(),
  },
}));

vi.mock('@/services/pushSubscriptionService', () => ({
  pushSubscriptionService: {
    removeSubscriptionFromDatabase: () => mockRemoveSubscriptionFromDatabase(),
  },
}));

import { AuthProvider, useAuth } from '../useAuth';
import { supabase } from '@/lib/supabase';

const mockSupabaseAuth = vi.mocked(supabase.auth);

function wrapper({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    localStorage.clear();
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useAuth hook outside provider', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('initialization', () => {
    it('should initialize with loading state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('should complete loading after getSession resolves', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set user and session when session exists', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token',
      } as any;

      mockSupabaseAuth.getSession.mockResolvedValue({
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

    // Note: subscribe/unsubscribe tests removed - they only verify mock calls
    // without testing meaningful behavior. Subscription is tested implicitly
    // through the auth state change handling tests.
  });

  describe('signIn', () => {
    it('should call signInWithPassword with correct credentials', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null } as any,
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should throw error when signIn fails', async () => {
      const authError = new Error('Invalid credentials');
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError as any,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'wrong');
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('signUp', () => {
    it('should call signUp with email and password', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUp('new@example.com', 'password123');
      });

      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: '',
          },
        },
      });
    });

    it('should include full_name when provided', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUp('new@example.com', 'password123', 'John Doe');
      });

      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'John Doe',
          },
        },
      });
    });

    it('should throw error when signUp fails', async () => {
      const authError = new Error('Email already registered');
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: authError as any,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signUp('existing@example.com', 'password');
        })
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('signInWithGoogle', () => {
    it('should call signInWithOAuth with google provider', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://oauth.google.com' } as any,
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/auth/v1/callback'),
        },
      });
    });

    it('should throw error when Google OAuth fails', async () => {
      const authError = new Error('OAuth error');
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: null } as any,
        error: authError as any,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signInWithGoogle();
        })
      ).rejects.toThrow('OAuth error');
    });
  });

  describe('signInWithGoogleIdToken', () => {
    it('should call signInWithIdToken with google provider and token', async () => {
      mockSupabaseAuth.signInWithIdToken.mockResolvedValue({
        data: { user: null, session: null } as any,
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signInWithGoogleIdToken('google-id-token-123');
      });

      expect(mockSupabaseAuth.signInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'google-id-token-123',
      });
    });

    it('should throw error when ID token auth fails', async () => {
      const authError = new Error('Invalid token');
      mockSupabaseAuth.signInWithIdToken.mockResolvedValue({
        data: { user: null, session: null } as any,
        error: authError as any,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signInWithGoogleIdToken('invalid-token');
        })
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('signOut', () => {
    beforeEach(() => {
      mockRemoveSubscriptionFromDatabase.mockReset();
    });

    it('should call supabase signOut', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });
      mockRemoveSubscriptionFromDatabase.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });

    it('should throw error when signOut fails', async () => {
      const authError = new Error('Sign out failed');
      mockSupabaseAuth.signOut.mockResolvedValue({ error: authError as any });
      mockRemoveSubscriptionFromDatabase.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signOut();
        })
      ).rejects.toThrow('Sign out failed');
    });

    it('should remove push subscription from database before signing out', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });
      mockRemoveSubscriptionFromDatabase.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      // Verify database cleanup was called (browser subscription preserved)
      expect(mockRemoveSubscriptionFromDatabase).toHaveBeenCalled();
      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });

    it('should complete sign out even if database cleanup fails', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });
      mockRemoveSubscriptionFromDatabase.mockRejectedValue(new Error('Database cleanup failed'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw even though database cleanup failed
      await act(async () => {
        await result.current.signOut();
      });

      // Database cleanup was attempted
      expect(mockRemoveSubscriptionFromDatabase).toHaveBeenCalled();
      // Sign out still completed
      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });

    it('should prevent notification leak by cleaning up database subscription on account switch', async () => {
      // Scenario: User A logs out, User B logs in on same device
      // The push subscription database record should be cleaned up when User A logs out
      // to prevent User B from receiving User A's notifications
      // Note: Browser subscription is preserved for easier re-subscription
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });
      mockRemoveSubscriptionFromDatabase.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // User A signs out
      await act(async () => {
        await result.current.signOut();
      });

      // Verify push subscription database record was cleaned up
      expect(mockRemoveSubscriptionFromDatabase).toHaveBeenCalledTimes(1);

      // This ensures that when User B signs in on the same device,
      // they won't receive User A's push notifications because
      // the subscription endpoint has been removed from the database.
      // The browser subscription is preserved so User A (or User B)
      // can easily re-enable notifications without re-granting permission.
    });
  });

  describe('auth state change handling', () => {
    it('should update user and session on SIGNED_IN event', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockSession = {
        user: { id: 'user-456', email: 'logged@example.com' },
        access_token: 'new-token',
      };

      act(() => {
        authStateCallback?.('SIGNED_IN', mockSession);
      });

      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.session).toEqual(mockSession);
    });

    it('should clear user and session on SIGNED_OUT event', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token',
      } as any;

      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockSession.user);
      });

      act(() => {
        authStateCallback?.('SIGNED_OUT', null);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('should navigate to returnUrl after SIGNED_IN when returnUrl exists', async () => {
      localStorage.setItem('returnUrl', '/events/123');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockSession = {
        user: { id: 'user-456' },
        access_token: 'token',
      };

      act(() => {
        authStateCallback?.('SIGNED_IN', mockSession);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/events/123');
      expect(localStorage.getItem('returnUrl')).toBeNull();
    });

    it('should not navigate to unsafe returnUrl (external link)', async () => {
      localStorage.setItem('returnUrl', '//malicious.com');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockSession = {
        user: { id: 'user-456' },
        access_token: 'token',
      };

      act(() => {
        authStateCallback?.('SIGNED_IN', mockSession);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(localStorage.getItem('returnUrl')).toBeNull();
    });

    it('should navigate to event page after SIGNED_IN with pending event invite', async () => {
      localStorage.setItem('pendingInvite', JSON.stringify({ type: 'event', id: 'event-123' }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockSession = {
        user: { id: 'user-456' },
        access_token: 'token',
      };

      act(() => {
        authStateCallback?.('SIGNED_IN', mockSession);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/signup/event-123');
      expect(localStorage.getItem('pendingInvite')).toBeNull();
    });

    it('should navigate to group page after SIGNED_IN with pending group invite', async () => {
      localStorage.setItem('pendingInvite', JSON.stringify({ type: 'group', id: 'group-456' }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockSession = {
        user: { id: 'user-456' },
        access_token: 'token',
      };

      act(() => {
        authStateCallback?.('SIGNED_IN', mockSession);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/groups/group-456');
      expect(localStorage.getItem('pendingInvite')).toBeNull();
    });

    it('should handle malformed pendingInvite gracefully', async () => {
      localStorage.setItem('pendingInvite', 'not-valid-json');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockSession = {
        user: { id: 'user-456' },
        access_token: 'token',
      };

      act(() => {
        authStateCallback?.('SIGNED_IN', mockSession);
      });

      // Malformed data should be silently removed without navigating
      expect(localStorage.getItem('pendingInvite')).toBeNull();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should prioritize returnUrl over pendingInvite', async () => {
      localStorage.setItem('returnUrl', '/events/priority');
      localStorage.setItem('pendingInvite', JSON.stringify({ type: 'group', id: 'group-456' }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockSession = {
        user: { id: 'user-456' },
        access_token: 'token',
      };

      act(() => {
        authStateCallback?.('SIGNED_IN', mockSession);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/events/priority');
      expect(localStorage.getItem('returnUrl')).toBeNull();
      // pendingInvite should still exist since returnUrl was used
      expect(localStorage.getItem('pendingInvite')).not.toBeNull();
    });

    it('should handle incomplete pendingInvite object', async () => {
      localStorage.setItem('pendingInvite', JSON.stringify({ type: 'event' })); // missing id

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockSession = {
        user: { id: 'user-456' },
        access_token: 'token',
      };

      act(() => {
        authStateCallback?.('SIGNED_IN', mockSession);
      });

      // Should not navigate anywhere since id is missing
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(localStorage.getItem('pendingInvite')).toBeNull();
    });
  });
});
