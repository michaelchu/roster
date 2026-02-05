import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mock user for testing
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
};

// Mock services
const mockGetNotifications = vi.fn();
const mockGetUnreadCount = vi.fn();
const mockGetPreferences = vi.fn();
const mockUpdatePreferences = vi.fn();
const mockIsSubscribed = vi.fn();
const mockSubscribe = vi.fn();
const mockGetPermissionStatus = vi.fn();
const mockIsSupported = vi.fn();
const mockIsConfigured = vi.fn();
const mockSubscribeToNotifications = vi.fn();

vi.mock('@/services', () => ({
  notificationService: {
    getNotifications: () => mockGetNotifications(),
    getUnreadCount: () => mockGetUnreadCount(),
    subscribeToNotifications: (...args: unknown[]) => mockSubscribeToNotifications(...args),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
  notificationPreferenceService: {
    getPreferences: () => mockGetPreferences(),
    updatePreferences: (updates: unknown) => mockUpdatePreferences(updates),
  },
  pushSubscriptionService: {
    isSupported: () => mockIsSupported(),
    isConfigured: () => mockIsConfigured(),
    isSubscribed: () => mockIsSubscribed(),
    subscribe: () => mockSubscribe(),
    getPermissionStatus: () => mockGetPermissionStatus(),
    requestPermission: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/errorHandler', () => ({
  logError: vi.fn(),
}));

import { useNotifications } from '../useNotifications';

function wrapper({ children }: { children: ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeToNotifications.mockReturnValue(() => {});
    mockIsSupported.mockReturnValue(true);
    mockIsConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('auto-resubscribe on sign in', () => {
    it('should auto-resubscribe when browser has existing subscription and permission is granted', async () => {
      // Scenario: User signed out, signed back in on same device (Android PWA or browser)
      // Browser still has push subscription from before
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: false });
      mockIsSubscribed.mockResolvedValue(true); // Browser HAS subscription
      mockGetPermissionStatus.mockReturnValue('granted'); // Permission was previously granted
      mockSubscribe.mockResolvedValue({ endpoint: 'https://example.com/push' });
      mockUpdatePreferences.mockResolvedValue({ push_enabled: true });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have called subscribe to register with database for current user
      expect(mockSubscribe).toHaveBeenCalled();
      // Should have updated database preference to enabled
      expect(mockUpdatePreferences).toHaveBeenCalledWith({ push_enabled: true });
      // Should show as subscribed
      expect(result.current.isSubscribed).toBe(true);
    });

    it('should NOT auto-subscribe for new users without existing browser subscription', async () => {
      // Scenario: Brand new user, first time enabling notifications
      // Browser has no push subscription yet
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: false });
      mockIsSubscribed.mockResolvedValue(false); // Browser has NO subscription
      mockGetPermissionStatus.mockReturnValue('default'); // Never prompted

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should NOT auto-subscribe - let user opt-in via settings
      expect(mockSubscribe).not.toHaveBeenCalled();
      expect(mockUpdatePreferences).not.toHaveBeenCalled();
      expect(result.current.isSubscribed).toBe(false);
    });

    it('should NOT auto-subscribe when permission is not granted even with browser subscription', async () => {
      // Edge case: Browser has subscription but permission changed to denied
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: true });
      mockIsSubscribed.mockResolvedValue(true); // Browser has subscription
      mockGetPermissionStatus.mockReturnValue('denied'); // But permission is now denied

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should NOT try to subscribe when permission is denied
      expect(mockSubscribe).not.toHaveBeenCalled();
      expect(result.current.isSubscribed).toBe(false);
    });

    it('should handle auto-resubscribe failure gracefully', async () => {
      // Scenario: Auto-resubscribe fails (e.g., network error)
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: true });
      mockIsSubscribed.mockResolvedValue(true);
      mockGetPermissionStatus.mockReturnValue('granted');
      mockSubscribe.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have attempted to subscribe
      expect(mockSubscribe).toHaveBeenCalled();
      // But should gracefully fall back to not subscribed
      expect(result.current.isSubscribed).toBe(false);
      // Should not have updated database preferences since subscribe failed
      expect(mockUpdatePreferences).not.toHaveBeenCalled();
    });
  });

  describe('iOS PWA scenario (separate storage context)', () => {
    it('should not auto-subscribe when iOS PWA has no browser subscription', async () => {
      // Scenario: User enabled notifications in browser, then installed PWA on iOS
      // iOS PWA has separate storage - no browser subscription exists in PWA context
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      // Database preference is enabled (from browser session)
      mockGetPreferences.mockResolvedValue({ push_enabled: true });
      // But iOS PWA has no browser subscription (separate storage)
      mockIsSubscribed.mockResolvedValue(false);
      mockGetPermissionStatus.mockReturnValue('default'); // New context, never prompted

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should NOT auto-subscribe - user needs to re-enable in PWA settings
      expect(mockSubscribe).not.toHaveBeenCalled();
      expect(result.current.isSubscribed).toBe(false);
      // Note: Database preference remains enabled, but UI toggle should show OFF
      // because isSubscribed is false (no browser subscription)
    });
  });

  describe('Android PWA scenario (shared storage context)', () => {
    it('should auto-resubscribe when Android PWA shares browser subscription', async () => {
      // Scenario: User enabled notifications in browser, then installed PWA on Android
      // Android PWA shares storage with browser - subscription persists
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: true });
      // Android PWA shares browser subscription
      mockIsSubscribed.mockResolvedValue(true);
      mockGetPermissionStatus.mockReturnValue('granted');
      mockSubscribe.mockResolvedValue({ endpoint: 'https://example.com/push' });
      mockUpdatePreferences.mockResolvedValue({ push_enabled: true });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should auto-resubscribe since browser subscription exists
      expect(mockSubscribe).toHaveBeenCalled();
      expect(result.current.isSubscribed).toBe(true);
    });
  });

  describe('account switching', () => {
    it('should reset subscription state when user changes', async () => {
      // Start with User A subscribed
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: true });
      mockIsSubscribed.mockResolvedValue(true);
      mockGetPermissionStatus.mockReturnValue('granted');
      mockSubscribe.mockResolvedValue({ endpoint: 'https://example.com/push' });
      mockUpdatePreferences.mockResolvedValue({ push_enabled: true });

      const { result, rerender } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.isSubscribed).toBe(true);
      });

      // User signs out (user becomes null)
      mockUseAuth.mockReturnValue({ user: null });
      rerender();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // State should be reset
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.preferences).toBeNull();
    });

    it('should re-evaluate subscription when new user signs in', async () => {
      // User B signs in after User A signed out
      const userB = { id: 'user-456', email: 'userb@example.com' };
      mockUseAuth.mockReturnValue({ user: userB });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: false }); // User B has different preferences
      mockIsSubscribed.mockResolvedValue(true); // Browser still has subscription
      mockGetPermissionStatus.mockReturnValue('granted');
      mockSubscribe.mockResolvedValue({ endpoint: 'https://example.com/push' });
      mockUpdatePreferences.mockResolvedValue({ push_enabled: true });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should auto-resubscribe for User B since browser has subscription
      expect(mockSubscribe).toHaveBeenCalled();
      expect(result.current.isSubscribed).toBe(true);
    });
  });

  describe('no user signed in', () => {
    it('should not load anything when no user is signed in', async () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetNotifications).not.toHaveBeenCalled();
      expect(mockIsSubscribed).not.toHaveBeenCalled();
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.preferences).toBeNull();
    });
  });

  describe('push notification support', () => {
    it('should report correct support status', async () => {
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: false });
      mockIsSubscribed.mockResolvedValue(false);
      mockGetPermissionStatus.mockReturnValue('default');
      mockIsSupported.mockReturnValue(true);
      mockIsConfigured.mockReturnValue(true);

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isSupported).toBe(true);
      expect(result.current.isConfigured).toBe(true);
    });

    it('should report unsupported when browser lacks push API', async () => {
      mockUseAuth.mockReturnValue({ user: mockUser });
      mockGetNotifications.mockResolvedValue([]);
      mockGetUnreadCount.mockResolvedValue(0);
      mockGetPreferences.mockResolvedValue({ push_enabled: false });
      mockIsSubscribed.mockResolvedValue(false);
      mockGetPermissionStatus.mockReturnValue('default');
      mockIsSupported.mockReturnValue(false); // Browser doesn't support push
      mockIsConfigured.mockReturnValue(true);

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isSupported).toBe(false);
    });
  });
});
