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
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn(),
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

  // ============================================================================
  // Notification Queue Functions Tests
  // ============================================================================

  describe('queueNotification', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should call RPC to insert notification into queue', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueNotification({
        recipientUserId: 'user-1',
        notificationType: 'new_signup',
        title: 'Test Title',
        body: 'Test Body',
        eventId: 'event-1',
        participantId: 'participant-1',
        actorUserId: 'actor-1',
        actionUrl: '/signup/event-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'user-1',
        p_notification_type: 'new_signup',
        p_title: 'Test Title',
        p_body: 'Test Body',
        p_event_id: 'event-1',
        p_participant_id: 'participant-1',
        p_actor_user_id: 'actor-1',
        p_action_url: '/signup/event-1',
      });
    });

    it('should handle optional fields with null defaults', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueNotification({
        recipientUserId: 'user-1',
        notificationType: 'new_signup',
        title: 'Test Title',
        body: 'Test Body',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'user-1',
        p_notification_type: 'new_signup',
        p_title: 'Test Title',
        p_body: 'Test Body',
        p_event_id: undefined,
        p_participant_id: undefined,
        p_actor_user_id: undefined,
        p_action_url: undefined,
      });
    });

    it('should silently ignore duplicate constraint violations (23505)', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: { code: '23505', message: 'Duplicate' } });

      await notificationService.queueNotification({
        recipientUserId: 'user-1',
        notificationType: 'new_signup',
        title: 'Test',
        body: 'Test',
      });

      expect(console.error).not.toHaveBeenCalled();
    });

    it('should log other errors', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: { code: 'OTHER', message: 'Failed' } });

      await notificationService.queueNotification({
        recipientUserId: 'user-1',
        notificationType: 'new_signup',
        title: 'Test',
        body: 'Test',
      });

      expect(console.error).toHaveBeenCalledWith('Failed to queue notification', {
        code: 'OTHER',
        message: 'Failed',
      });
    });
  });

  describe('queueNewSignup', () => {
    it('should queue new_signup notification to organizer', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueNewSignup({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantId: 'p-1',
        participantName: 'John Doe',
        actorUserId: 'user-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'org-1',
        p_notification_type: 'new_signup',
        p_title: 'New signup for Test Event',
        p_body: 'John Doe just signed up',
        p_event_id: 'event-1',
        p_participant_id: 'p-1',
        p_actor_user_id: 'user-1',
        p_action_url: '/signup/event-1',
      });
    });

    it('should NOT notify organizer if they signed up themselves', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueNewSignup({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantId: 'p-1',
        participantName: 'Organizer',
        actorUserId: 'org-1', // Same as organizer
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should notify organizer for guest signup (null actorUserId)', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueNewSignup({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantId: 'p-1',
        participantName: 'Guest User',
        actorUserId: null, // Guest registration
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'queue_notification',
        expect.objectContaining({
          p_recipient_user_id: 'org-1',
          p_notification_type: 'new_signup',
          p_actor_user_id: undefined,
        })
      );
    });
  });

  describe('queueSignupConfirmed', () => {
    it('should queue signup_confirmed notification to participant', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueSignupConfirmed({
        participantUserId: 'user-1',
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantId: 'p-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'user-1',
        p_notification_type: 'signup_confirmed',
        p_title: 'Signup confirmed!',
        p_body: "You're registered for Test Event",
        p_event_id: 'event-1',
        p_participant_id: 'p-1',
        p_actor_user_id: undefined,
        p_action_url: '/signup/event-1',
      });
    });

    it('should NOT send confirmation to organizer', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueSignupConfirmed({
        participantUserId: 'org-1', // Same as organizer
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantId: 'p-1',
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('queueCapacityReached', () => {
    it('should queue capacity_reached notification to organizer', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueCapacityReached({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        maxParticipants: 20,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'org-1',
        p_notification_type: 'capacity_reached',
        p_title: 'Test Event is now full!',
        p_body: 'Your event has reached maximum capacity (20 participants)',
        p_event_id: 'event-1',
        p_participant_id: undefined,
        p_actor_user_id: undefined,
        p_action_url: '/signup/event-1',
      });
    });
  });

  describe('queueWithdrawal', () => {
    it('should queue withdrawal notification to organizer', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueWithdrawal({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantName: 'John Doe',
        actorUserId: 'user-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'org-1',
        p_notification_type: 'withdrawal',
        p_title: 'Withdrawal from Test Event',
        p_body: 'John Doe has withdrawn',
        p_event_id: 'event-1',
        p_participant_id: undefined,
        p_actor_user_id: 'user-1',
        p_action_url: '/signup/event-1',
      });
    });

    it('should NOT notify organizer if they withdrew themselves', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueWithdrawal({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantName: 'Organizer',
        actorUserId: 'org-1', // Same as organizer
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should notify organizer when actorUserId is null', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueWithdrawal({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantName: 'Guest User',
        actorUserId: null, // Unknown actor
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'queue_notification',
        expect.objectContaining({
          p_recipient_user_id: 'org-1',
          p_notification_type: 'withdrawal',
          p_actor_user_id: undefined,
        })
      );
    });
  });

  describe('queuePaymentReceived', () => {
    it('should queue payment_received notification to organizer', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queuePaymentReceived({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        participantId: 'p-1',
        participantName: 'John Doe',
        actorUserId: 'user-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'org-1',
        p_notification_type: 'payment_received',
        p_title: 'Payment received',
        p_body: 'John Doe paid for Test Event',
        p_event_id: 'event-1',
        p_participant_id: 'p-1',
        p_actor_user_id: 'user-1',
        p_action_url: '/signup/event-1',
      });
    });
  });

  describe('queueEventUpdated', () => {
    it('should queue event_updated notifications to all participants except organizer', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueEventUpdated({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        changes: ['location', 'time'],
        participantUserIds: ['user-1', 'user-2', 'org-1'],
      });

      // Should be called twice (for user-1 and user-2, but not org-1)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'user-1',
        p_notification_type: 'event_updated',
        p_title: 'Event updated: Test Event',
        p_body: 'The location, time has been updated',
        p_event_id: 'event-1',
        p_participant_id: undefined,
        p_actor_user_id: 'org-1',
        p_action_url: '/signup/event-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'user-2',
        p_notification_type: 'event_updated',
        p_title: 'Event updated: Test Event',
        p_body: 'The location, time has been updated',
        p_event_id: 'event-1',
        p_participant_id: undefined,
        p_actor_user_id: 'org-1',
        p_action_url: '/signup/event-1',
      });
    });

    it('should NOT send notifications when no changes provided', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueEventUpdated({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        changes: [],
        participantUserIds: ['user-1', 'user-2'],
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle empty participant list', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueEventUpdated({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        changes: ['location'],
        participantUserIds: [],
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should send zero notifications when only organizer is participant', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueEventUpdated({
        organizerId: 'org-1',
        eventId: 'event-1',
        eventName: 'Test Event',
        changes: ['location'],
        participantUserIds: ['org-1'], // Only organizer registered
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('queueEventCancelled', () => {
    it('should queue event_cancelled notifications to all participants except organizer', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueEventCancelled({
        organizerId: 'org-1',
        eventName: 'Test Event',
        participantUserIds: ['user-1', 'user-2', 'org-1'],
      });

      // Should be called twice (for user-1 and user-2, but not org-1)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'user-1',
        p_notification_type: 'event_cancelled',
        p_title: 'Event cancelled: Test Event',
        p_body: 'The event "Test Event" has been cancelled',
        p_event_id: undefined,
        p_participant_id: undefined,
        p_actor_user_id: 'org-1',
        p_action_url: '/events',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_user_id: 'user-2',
        p_notification_type: 'event_cancelled',
        p_title: 'Event cancelled: Test Event',
        p_body: 'The event "Test Event" has been cancelled',
        p_event_id: undefined,
        p_participant_id: undefined,
        p_actor_user_id: 'org-1',
        p_action_url: '/events',
      });
    });

    it('should NOT notify organizer', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueEventCancelled({
        organizerId: 'org-1',
        eventName: 'Test Event',
        participantUserIds: ['org-1'], // Only organizer
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle empty participant list', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await notificationService.queueEventCancelled({
        organizerId: 'org-1',
        eventName: 'Test Event',
        participantUserIds: [],
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });
});
