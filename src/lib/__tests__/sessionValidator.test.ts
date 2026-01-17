/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockToast = vi.mocked(toast);

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

import { validateSession, requireValidSession } from '../sessionValidator';
import { supabase } from '@/lib/supabase';

const mockSupabaseAuth = vi.mocked(supabase.auth);

describe('sessionValidator', () => {
  const originalLocation = window.location;
  let mockLocation: { href: string; pathname: string };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock window.location
    mockLocation = { href: '', pathname: '/events' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('validateSession', () => {
    it('should return user when session is valid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { user: mockUser, access_token: 'token' } as any;

      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await validateSession();

      expect(result).toEqual(mockUser);
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should show toast and redirect when session is null', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await validateSession();

      expect(result).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith(
        'Your session has expired. Please sign in again.'
      );
      expect(mockLocation.href).toBe('/auth/login');
    });

    it('should show toast and redirect when there is an error', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Auth error') as any,
      });

      const result = await validateSession();

      expect(result).toBeNull();
      expect(mockToast.error).toHaveBeenCalled();
      expect(mockLocation.href).toBe('/auth/login');
    });

    it('should show toast and redirect when session has no user', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: { user: null, access_token: 'token' } as any },
        error: null,
      });

      const result = await validateSession();

      expect(result).toBeNull();
      expect(mockLocation.href).toBe('/auth/login');
    });

    it('should store returnUrl when on a protected page', async () => {
      mockLocation.pathname = '/events/123';
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await validateSession();

      expect(localStorage.getItem('returnUrl')).toBe('/events/123');
    });

    it('should not store returnUrl when already on login page', async () => {
      mockLocation.pathname = '/auth/login';
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await validateSession();

      expect(localStorage.getItem('returnUrl')).toBeNull();
    });

    it('should not store returnUrl when on register page', async () => {
      mockLocation.pathname = '/auth/register';
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await validateSession();

      expect(localStorage.getItem('returnUrl')).toBeNull();
    });
  });

  describe('requireValidSession', () => {
    it('should return user when session is valid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { user: mockUser, access_token: 'token' } as any;

      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await requireValidSession();

      expect(result).toEqual(mockUser);
    });

    it('should throw error when session is invalid', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(requireValidSession()).rejects.toThrow('Session expired');
    });

    it('should throw error and still show toast when session is invalid', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      try {
        await requireValidSession();
      } catch {
        // Expected error
      }

      expect(mockToast.error).toHaveBeenCalledWith(
        'Your session has expired. Please sign in again.'
      );
    });

    it('should throw error and redirect when session is invalid', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      try {
        await requireValidSession();
      } catch {
        // Expected error
      }

      expect(mockLocation.href).toBe('/auth/login');
    });
  });
});
