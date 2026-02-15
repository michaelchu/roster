/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn().mockResolvedValue({ data: 'mock-id', error: null }),
  },
}));

import { participantActivityService } from '../participantActivityService';
import { supabase } from '@/lib/supabase';

const mockSupabase = vi.mocked(supabase);

describe('participantActivityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getEventActivity', () => {
    it('should fetch activity for an event with default limit', async () => {
      const mockActivities = [
        {
          id: 'act-1',
          participant_id: 'p-1',
          event_id: 'e-1',
          activity_type: 'joined',
          participant_name: 'John Doe',
          details: { slot_number: 1 },
          created_at: '2023-01-01T10:00:00Z',
        },
        {
          id: 'act-2',
          participant_id: 'p-2',
          event_id: 'e-1',
          activity_type: 'payment_updated',
          participant_name: 'Jane Smith',
          details: { from: 'pending', to: 'paid' },
          created_at: '2023-01-01T11:00:00Z',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockActivities, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantActivityService.getEventActivity('e-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('participant_activity_log');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('event_id', 'e-1');
      expect(mockQueryChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryChain.limit).toHaveBeenCalledWith(100);
      expect(result).toEqual(mockActivities);
    });

    it('should fetch activity with custom limit', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await participantActivityService.getEventActivity('e-1', 50);

      expect(mockQueryChain.limit).toHaveBeenCalledWith(50);
    });

    it('should return empty array when no data', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantActivityService.getEventActivity('e-1');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(participantActivityService.getEventActivity('e-1')).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('getParticipantActivity', () => {
    it('should fetch activity for a participant with default limit', async () => {
      const mockActivities = [
        {
          id: 'act-1',
          participant_id: 'p-1',
          event_id: 'e-1',
          activity_type: 'joined',
          participant_name: 'John Doe',
          details: { slot_number: 1 },
          created_at: '2023-01-01T10:00:00Z',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockActivities, error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantActivityService.getParticipantActivity('p-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('participant_activity_log');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('participant_id', 'p-1');
      expect(mockQueryChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryChain.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockActivities);
    });

    it('should throw error on database failure', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };
      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(participantActivityService.getParticipantActivity('p-1')).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('logJoined', () => {
    it('should call RPC with correct parameters', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logJoined({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        claimedByUserId: 'user-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: 'p-1',
        p_event_id: 'e-1',
        p_activity_type: 'joined',
        p_participant_name: 'John Doe',
        p_details: {
          claimed_by_user_id: 'user-1',
        },
      });
    });

    it('should handle null claimedByUserId', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logJoined({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        claimedByUserId: null,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: 'p-1',
        p_event_id: 'e-1',
        p_activity_type: 'joined',
        p_participant_name: 'John Doe',
        p_details: {
          claimed_by_user_id: null,
        },
      });
    });

    it('should log error on RPC failure without throwing', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      } as any);

      await participantActivityService.logJoined({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        claimedByUserId: null,
      });

      expect(console.error).toHaveBeenCalledWith('Failed to log participant activity', {
        message: 'Insert failed',
      });
    });
  });

  describe('logWithdrew', () => {
    it('should call RPC with correct parameters', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logWithdrew({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        paymentStatus: 'paid',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: 'p-1',
        p_event_id: 'e-1',
        p_activity_type: 'withdrew',
        p_participant_name: 'John Doe',
        p_details: {
          payment_status: 'paid',
        },
      });
    });
  });

  describe('logPaymentUpdated', () => {
    it('should call RPC with correct parameters', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logPaymentUpdated({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        fromStatus: 'pending',
        toStatus: 'paid',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: 'p-1',
        p_event_id: 'e-1',
        p_activity_type: 'payment_updated',
        p_participant_name: 'John Doe',
        p_details: {
          from: 'pending',
          to: 'paid',
        },
      });
    });
  });

  describe('logInfoUpdated', () => {
    it('should call RPC with all changed fields', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logInfoUpdated({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        changes: {
          name: { from: 'John', to: 'John Doe' },
          email: { from: 'old@test.com', to: 'new@test.com' },
          phone: { from: null, to: '555-1234' },
          notes: { from: 'Old notes', to: 'New notes' },
        },
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: 'p-1',
        p_event_id: 'e-1',
        p_activity_type: 'info_updated',
        p_participant_name: 'John Doe',
        p_details: {
          name: { from: 'John', to: 'John Doe' },
          email: { from: 'old@test.com', to: 'new@test.com' },
          phone: { from: null, to: '555-1234' },
          notes: { from: 'Old notes', to: 'New notes' },
        },
      });
    });

    it('should only include changed fields in details', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logInfoUpdated({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        changes: {
          name: { from: 'John', to: 'John Doe' },
        },
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: 'p-1',
        p_event_id: 'e-1',
        p_activity_type: 'info_updated',
        p_participant_name: 'John Doe',
        p_details: {
          name: { from: 'John', to: 'John Doe' },
        },
      });
    });

    it('should not call RPC when no changes provided', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logInfoUpdated({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        changes: {},
      });

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('logLabelAdded', () => {
    it('should call RPC with label details', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logLabelAdded({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        labelId: 'label-1',
        labelName: 'VIP',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: 'p-1',
        p_event_id: 'e-1',
        p_activity_type: 'label_added',
        p_participant_name: 'John Doe',
        p_details: {
          label_id: 'label-1',
          label_name: 'VIP',
        },
      });
    });
  });

  describe('logLabelRemoved', () => {
    it('should call RPC with label details', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      await participantActivityService.logLabelRemoved({
        participantId: 'p-1',
        eventId: 'e-1',
        participantName: 'John Doe',
        labelId: 'label-1',
        labelName: 'VIP',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: 'p-1',
        p_event_id: 'e-1',
        p_activity_type: 'label_removed',
        p_participant_name: 'John Doe',
        p_details: {
          label_id: 'label-1',
          label_name: 'VIP',
        },
      });
    });
  });

  describe('activity logging with null participantId', () => {
    it('should handle null participantId for deleted participants', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'mock-id', error: null } as any);

      // This simulates logging activity for a participant that was deleted
      // The participantId can be null per the type definition
      await participantActivityService.logWithdrew({
        participantId: null as unknown as string, // Type coercion for test
        eventId: 'e-1',
        participantName: 'Deleted User',
        paymentStatus: 'pending',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_participant_activity', {
        p_participant_id: null,
        p_event_id: 'e-1',
        p_activity_type: 'withdrew',
        p_participant_name: 'Deleted User',
        p_details: {
          payment_status: 'pending',
        },
      });
    });
  });
});
