/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

import { pushSubscriptionService } from '../pushSubscriptionService';
import { supabase } from '@/lib/supabase';

const mockSupabase = vi.mocked(supabase);

// Mock browser APIs
const mockServiceWorkerRegistration = {
  pushManager: {
    subscribe: vi.fn(),
    getSubscription: vi.fn(),
  },
};

const mockPushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
  toJSON: vi.fn(() => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: {
      p256dh: 'test-p256dh-key',
      auth: 'test-auth-key',
    },
  })),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

describe('pushSubscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset global mocks
    (global as any).PushManager = vi.fn();
    (global as any).Notification = {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };

    // Mock IndexedDB
    const mockIndexedDB = {
      open: vi.fn(() => {
        const request = {
          result: null as any,
          error: null,
          onsuccess: null as any,
          onerror: null as any,
          onupgradeneeded: null as any,
        };

        // Execute synchronously to avoid timeout issues in tests
        Promise.resolve().then(() => {
          const db = {
            objectStoreNames: {
              contains: vi.fn(() => false),
            },
            createObjectStore: vi.fn(() => ({})),
            transaction: vi.fn(() => {
              const tx = {
                objectStore: vi.fn(() => ({
                  put: vi.fn(),
                })),
                oncomplete: null as any,
                onerror: null as any,
              };
              // Call oncomplete immediately
              Promise.resolve().then(() => {
                if (tx.oncomplete) tx.oncomplete();
              });
              return tx;
            }),
            close: vi.fn(),
          };
          request.result = db;

          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: request } as any);
          }
          if (request.onsuccess) {
            request.onsuccess();
          }
        });

        return request;
      }),
    };

    (global as any).indexedDB = mockIndexedDB;

    global.navigator = {
      serviceWorker: {
        ready: Promise.resolve(mockServiceWorkerRegistration as any),
      },
      userAgent: 'test-user-agent',
    } as any;

    global.window = {
      Notification: (global as any).Notification,
      PushManager: (global as any).PushManager,
      atob: vi.fn((str: string) => Buffer.from(str, 'base64').toString('binary')),
      indexedDB: mockIndexedDB as any,
    } as any;
  });

  describe('isSupported', () => {
    it('should return true when all APIs are available', () => {
      expect(pushSubscriptionService.isSupported()).toBe(true);
    });

    it('should return false when serviceWorker is not available', () => {
      delete (global.navigator as any).serviceWorker;
      expect(pushSubscriptionService.isSupported()).toBe(false);
    });

    it('should return false when PushManager is not available', () => {
      delete (global.window as any).PushManager;
      expect(pushSubscriptionService.isSupported()).toBe(false);
    });

    it('should return false when Notification is not available', () => {
      delete (global.window as any).Notification;
      expect(pushSubscriptionService.isSupported()).toBe(false);
    });
  });

  describe('getPermissionStatus', () => {
    it('should return current notification permission', () => {
      (global as any).Notification.permission = 'granted';
      expect(pushSubscriptionService.getPermissionStatus()).toBe('granted');
    });

    it('should return denied when Notification API not available', () => {
      delete (global.window as any).Notification;
      delete (global as any).Notification;
      expect(pushSubscriptionService.getPermissionStatus()).toBe('denied');
    });
  });

  describe('requestPermission', () => {
    it('should request and return permission status', async () => {
      const requestPermission = vi.fn().mockResolvedValue('granted');
      (global as any).Notification.requestPermission = requestPermission;
      global.window.Notification.requestPermission = requestPermission;

      const result = await pushSubscriptionService.requestPermission();

      expect(result).toBe('granted');
      expect(requestPermission).toHaveBeenCalled();
    });

    it('should return denied when Notification API not available', async () => {
      delete (global.window as any).Notification;
      delete (global as any).Notification;
      const result = await pushSubscriptionService.requestPermission();
      expect(result).toBe('denied');
    });
  });

  describe('isConfigured', () => {
    // Note: VAPID key is read at module load time from import.meta.env
    // Testing this in isolation requires a separate test file or dynamic imports
    // The key is validated during subscribe() which we test below
    it('should return isConfigured status', () => {
      const result = pushSubscriptionService.isConfigured();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('subscribe', () => {
    it('should subscribe to push notifications and save to database', async () => {
      mockServiceWorkerRegistration.pushManager.subscribe.mockResolvedValue(mockPushSubscription);

      const mockQueryChain = {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await pushSubscriptionService.subscribe();

      expect(result).toEqual({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      });

      expect(mockQueryChain.upsert).toHaveBeenCalledWith(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          p256dh_key: 'test-p256dh-key',
          auth_key: 'test-auth-key',
          user_agent: 'test-user-agent',
          active: true,
          last_used_at: expect.any(String),
        },
        {
          onConflict: 'endpoint',
        }
      );
    });

    it('should return null when push notifications not supported', async () => {
      delete (global.navigator as any).serviceWorker;
      const result = await pushSubscriptionService.subscribe();
      expect(result).toBeNull();
    });

    // Note: Cannot test invalid VAPID key because it's read at module load time

    it('should throw error when subscription fails', async () => {
      const error = new Error('Subscription failed');
      mockServiceWorkerRegistration.pushManager.subscribe.mockRejectedValue(error);

      await expect(pushSubscriptionService.subscribe()).rejects.toThrow('Subscription failed');
    });

    it('should throw error when database save fails', async () => {
      mockServiceWorkerRegistration.pushManager.subscribe.mockResolvedValue(mockPushSubscription);

      const mockQueryChain = {
        upsert: vi.fn().mockResolvedValue({ error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(pushSubscriptionService.subscribe()).rejects.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from push notifications and remove from database', async () => {
      mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(
        mockPushSubscription
      );

      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await pushSubscriptionService.unsubscribe();

      expect(mockQueryChain.delete).toHaveBeenCalled();
      expect(mockQueryChain.eq).toHaveBeenCalledWith(
        'endpoint',
        'https://fcm.googleapis.com/fcm/send/test-endpoint'
      );
      expect(mockPushSubscription.unsubscribe).toHaveBeenCalled();
    });

    it('should do nothing when not subscribed', async () => {
      mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(null);

      await pushSubscriptionService.unsubscribe();

      expect(mockPushSubscription.unsubscribe).not.toHaveBeenCalled();
    });

    it('should do nothing when not supported', async () => {
      delete (global.navigator as any).serviceWorker;
      await pushSubscriptionService.unsubscribe();
      expect(mockPushSubscription.unsubscribe).not.toHaveBeenCalled();
    });

    it('should throw error when unsubscribe fails', async () => {
      const error = new Error('Unsubscribe failed');
      mockServiceWorkerRegistration.pushManager.getSubscription.mockRejectedValue(error);

      await expect(pushSubscriptionService.unsubscribe()).rejects.toThrow('Unsubscribe failed');
    });
  });

  describe('isSubscribed', () => {
    it('should return true when subscribed', async () => {
      mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(
        mockPushSubscription
      );
      const result = await pushSubscriptionService.isSubscribed();
      expect(result).toBe(true);
    });

    it('should return false when not subscribed', async () => {
      mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(null);
      const result = await pushSubscriptionService.isSubscribed();
      expect(result).toBe(false);
    });

    it('should return false when not supported', async () => {
      delete (global.navigator as any).serviceWorker;
      const result = await pushSubscriptionService.isSubscribed();
      expect(result).toBe(false);
    });

    it('should return false when error occurs', async () => {
      mockServiceWorkerRegistration.pushManager.getSubscription.mockRejectedValue(
        new Error('Error')
      );
      const result = await pushSubscriptionService.isSubscribed();
      expect(result).toBe(false);
    });
  });

  describe('getSubscriptions', () => {
    it('should fetch active subscriptions from database', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-1',
          active: true,
          created_at: '2023-01-01',
        },
        {
          id: 'sub-2',
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-2',
          active: true,
          created_at: '2023-01-02',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockSubscriptions, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await pushSubscriptionService.getSubscriptions();

      expect(result).toEqual(mockSubscriptions);
      expect(mockQueryChain.eq).toHaveBeenCalledWith('active', true);
      expect(mockQueryChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should throw error when database query fails', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(pushSubscriptionService.getSubscriptions()).rejects.toThrow();
    });
  });

  describe('deactivateSubscription', () => {
    it('should deactivate a subscription by ID', async () => {
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await pushSubscriptionService.deactivateSubscription('sub-1');

      expect(mockQueryChain.update).toHaveBeenCalledWith({ active: false });
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'sub-1');
    });

    it('should throw error when database update fails', async () => {
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(pushSubscriptionService.deactivateSubscription('sub-1')).rejects.toThrow();
    });
  });
});
