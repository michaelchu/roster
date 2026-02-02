/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

import { notificationService } from '../notificationService';
import { supabase } from '@/lib/supabase';

const mockSupabase = vi.mocked(supabase);

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should fetch notifications with default pagination', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          recipient_user_id: 'user-1',
          type: 'new_signup',
          title: 'New signup',
          body: 'Someone signed up',
          created_at: '2023-01-01',
          read_at: null,
        },
        {
          id: 'notif-2',
          recipient_user_id: 'user-1',
          type: 'payment_received',
          title: 'Payment received',
          body: 'Payment confirmed',
          created_at: '2023-01-02',
          read_at: '2023-01-03',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationService.getNotifications();

      expect(result).toEqual(mockNotifications);
      expect(mockQueryChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryChain.range).toHaveBeenCalledWith(0, 49);
    });

    it('should fetch notifications with custom pagination', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await notificationService.getNotifications(20, 40);

      expect(mockQueryChain.range).toHaveBeenCalledWith(40, 59);
    });

    it('should throw error when database query fails', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(notificationService.getNotifications()).rejects.toThrow();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 5, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationService.getUnreadCount();

      expect(result).toBe(5);
      expect(mockQueryChain.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mockQueryChain.is).toHaveBeenCalledWith('read_at', null);
    });

    it('should return 0 when count is null', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationService.getUnreadCount();

      expect(result).toBe(0);
    });

    it('should throw error when database query fails', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: null, error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(notificationService.getUnreadCount()).rejects.toThrow();
    });
  });

  describe('getNotificationById', () => {
    it('should fetch a single notification by ID', async () => {
      const mockNotification = {
        id: 'notif-1',
        recipient_user_id: 'user-1',
        type: 'new_signup',
        title: 'New signup',
        body: 'Someone signed up',
        created_at: '2023-01-01',
        read_at: null,
      };

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockNotification, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationService.getNotificationById('notif-1');

      expect(result).toEqual(mockNotification);
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'notif-1');
    });

    it('should return null when notification not found (PGRST116)', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationService.getNotificationById('notif-999');

      expect(result).toBeNull();
    });

    it('should throw error for other database errors', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'OTHER_ERROR', message: 'Database error' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(notificationService.getNotificationById('notif-1')).rejects.toThrow();
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await notificationService.markAsRead('notif-1');

      expect(mockQueryChain.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'notif-1');
    });

    it('should throw error when database update fails', async () => {
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(notificationService.markAsRead('notif-1')).rejects.toThrow();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await notificationService.markAllAsRead();

      expect(mockQueryChain.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
      expect(mockQueryChain.is).toHaveBeenCalledWith('read_at', null);
    });

    it('should throw error when database update fails', async () => {
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(notificationService.markAllAsRead()).rejects.toThrow();
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification by ID', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await notificationService.deleteNotification('notif-1');

      expect(mockQueryChain.delete).toHaveBeenCalled();
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'notif-1');
    });

    it('should throw error when database delete fails', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(notificationService.deleteNotification('notif-1')).rejects.toThrow();
    });
  });

  describe('subscribeToNotifications', () => {
    it('should set up real-time subscription for user notifications', () => {
      const onInsert = vi.fn();
      const userId = 'user-1';

      const unsubscribe = notificationService.subscribeToNotifications(userId, onInsert);

      expect(mockSupabase.channel).toHaveBeenCalledWith(`notifications:${userId}`);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();

      // Test the callback
      const callback = mockChannel.on.mock.calls[0][2];
      const newNotification = {
        new: {
          id: 'notif-1',
          recipient_user_id: 'user-1',
          type: 'new_signup',
          title: 'New signup',
        },
      };
      callback(newNotification);

      expect(onInsert).toHaveBeenCalledWith(newNotification.new);

      // Test unsubscribe
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
