/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  throwIfSupabaseError: vi.fn((result) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }),
  requireData: vi.fn((data, operation) => {
    if (data === null || data === undefined) {
      throw new Error(`Operation '${operation}' returned no data`);
    }
    return data;
  }),
}));

import { notificationPreferenceService } from '../notificationPreferenceService';
import { supabase } from '@/lib/supabase';

const mockSupabase = vi.mocked(supabase);

describe('notificationPreferenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for authenticated user
    (mockSupabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  describe('getPreferences', () => {
    it('should fetch user preferences', async () => {
      const mockPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        push_enabled: true,
        notify_new_signup: true,
        notify_withdrawal: true,
        notify_payment_received: true,
        notify_capacity_reached: true,
        notify_signup_confirmed: true,
        notify_event_updated: true,
        notify_event_cancelled: true,
        notify_payment_reminder: true,
        notify_waitlist_promotion: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPreferences, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationPreferenceService.getPreferences();

      expect(result).toEqual(mockPreferences);
    });

    it('should return null when preferences do not exist (PGRST116)', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationPreferenceService.getPreferences();

      expect(result).toBeNull();
    });

    it('should throw error for other database errors', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'OTHER_ERROR', message: 'Database error' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(notificationPreferenceService.getPreferences()).rejects.toThrow();
    });
  });

  describe('getOrCreatePreferences', () => {
    it('should return existing preferences if they exist', async () => {
      const mockPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        push_enabled: true,
        notify_new_signup: true,
        notify_withdrawal: true,
        notify_payment_received: true,
        notify_capacity_reached: true,
        notify_signup_confirmed: true,
        notify_event_updated: true,
        notify_event_cancelled: true,
        notify_payment_reminder: true,
        notify_waitlist_promotion: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPreferences, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationPreferenceService.getOrCreatePreferences();

      expect(result).toEqual(mockPreferences);
    });

    it('should create default preferences when none exist', async () => {
      const mockNewPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        push_enabled: true,
        notify_new_signup: true,
        notify_withdrawal: true,
        notify_payment_received: true,
        notify_capacity_reached: true,
        notify_signup_confirmed: true,
        notify_event_updated: true,
        notify_event_cancelled: true,
        notify_payment_reminder: true,
        notify_waitlist_promotion: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      // Mock getPreferences returning null
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      // Mock insert returning new preferences
      const insertQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockNewPreferences, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as any)
        .mockReturnValueOnce(insertQueryChain as any);

      const result = await notificationPreferenceService.getOrCreatePreferences();

      expect(result).toEqual(mockNewPreferences);
      expect(insertQueryChain.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        push_enabled: true,
        notify_new_signup: true,
        notify_withdrawal: true,
        notify_payment_received: true,
        notify_capacity_reached: true,
        notify_signup_confirmed: true,
        notify_event_updated: true,
        notify_event_cancelled: true,
        notify_payment_reminder: true,
        notify_waitlist_promotion: true,
      });
    });

    it('should throw error when user is not authenticated', async () => {
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };
      mockSupabase.from.mockReturnValue(getQueryChain as any);

      (mockSupabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(notificationPreferenceService.getOrCreatePreferences()).rejects.toThrow(
        'Not authenticated'
      );
    });

    it('should throw error when insert fails', async () => {
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      const insertQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as any)
        .mockReturnValueOnce(insertQueryChain as any);

      await expect(notificationPreferenceService.getOrCreatePreferences()).rejects.toThrow();
    });

    it('should throw error when insert returns no data', async () => {
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      const insertQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as any)
        .mockReturnValueOnce(insertQueryChain as any);

      await expect(notificationPreferenceService.getOrCreatePreferences()).rejects.toThrow(
        "Operation 'create notification preferences' returned no data"
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences via upsert', async () => {
      const updates = {
        push_enabled: false,
        notify_new_signup: false,
      };

      const mockUpdatedPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        push_enabled: false,
        notify_new_signup: false,
        notify_withdrawal: true,
        notify_payment_received: true,
        notify_capacity_reached: true,
        notify_signup_confirmed: true,
        notify_event_updated: true,
        notify_event_cancelled: true,
        notify_payment_reminder: true,
        notify_waitlist_promotion: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-02',
      };

      const mockQueryChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedPreferences, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationPreferenceService.updatePreferences(updates);

      expect(result).toEqual(mockUpdatedPreferences);
      expect(mockQueryChain.upsert).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          ...updates,
          updated_at: expect.any(String),
        },
        {
          onConflict: 'user_id',
        }
      );
    });

    it('should throw error when user is not authenticated', async () => {
      (mockSupabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        notificationPreferenceService.updatePreferences({ push_enabled: false })
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw error when upsert fails', async () => {
      const mockQueryChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Upsert failed' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(
        notificationPreferenceService.updatePreferences({ push_enabled: false })
      ).rejects.toThrow();
    });

    it('should throw error when upsert returns no data', async () => {
      const mockQueryChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(
        notificationPreferenceService.updatePreferences({ push_enabled: false })
      ).rejects.toThrow("Operation 'update notification preferences' returned no data");
    });
  });

  describe('toggleNotificationType', () => {
    it('should toggle a specific notification type', async () => {
      const mockUpdatedPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        push_enabled: true,
        notify_new_signup: false,
        notify_withdrawal: true,
        notify_payment_received: true,
        notify_capacity_reached: true,
        notify_signup_confirmed: true,
        notify_event_updated: true,
        notify_event_cancelled: true,
        notify_payment_reminder: true,
        notify_waitlist_promotion: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-02',
      };

      const mockQueryChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedPreferences, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationPreferenceService.toggleNotificationType(
        'notify_new_signup',
        false
      );

      expect(result).toEqual(mockUpdatedPreferences);
      expect(mockQueryChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          notify_new_signup: false,
        }),
        expect.any(Object)
      );
    });
  });

  describe('enableAll', () => {
    it('should enable all notification types', async () => {
      const mockUpdatedPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        push_enabled: true,
        notify_new_signup: true,
        notify_withdrawal: true,
        notify_payment_received: true,
        notify_capacity_reached: true,
        notify_signup_confirmed: true,
        notify_event_updated: true,
        notify_event_cancelled: true,
        notify_payment_reminder: true,
        notify_waitlist_promotion: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-02',
      };

      const mockQueryChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedPreferences, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationPreferenceService.enableAll();

      expect(result).toEqual(mockUpdatedPreferences);
      expect(mockQueryChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          push_enabled: true,
          notify_new_signup: true,
          notify_withdrawal: true,
          notify_payment_received: true,
          notify_capacity_reached: true,
          notify_signup_confirmed: true,
          notify_event_updated: true,
          notify_event_cancelled: true,
          notify_payment_reminder: true,
          notify_waitlist_promotion: true,
        }),
        expect.any(Object)
      );
    });
  });

  describe('disableAll', () => {
    it('should disable all notifications via master toggle', async () => {
      const mockUpdatedPreferences = {
        id: 'pref-1',
        user_id: 'user-1',
        push_enabled: false,
        notify_new_signup: true,
        notify_withdrawal: true,
        notify_payment_received: true,
        notify_capacity_reached: true,
        notify_signup_confirmed: true,
        notify_event_updated: true,
        notify_event_cancelled: true,
        notify_payment_reminder: true,
        notify_waitlist_promotion: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-02',
      };

      const mockQueryChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedPreferences, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await notificationPreferenceService.disableAll();

      expect(result).toEqual(mockUpdatedPreferences);
      expect(mockQueryChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          push_enabled: false,
        }),
        expect.any(Object)
      );
    });
  });
});
