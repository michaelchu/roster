import { describe, it, expect, vi, beforeEach } from 'vitest';
import { participantService } from '../participantService';
import { mockParticipant, mockParticipantsList, mockLabel } from '@/test/fixtures/events';
import type { MockSupabaseQueryBuilder } from '@/test/types/mocks';

// Mock supabase
vi.mock('@/lib/supabase', () => {
  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }));

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

describe('participantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getParticipantsByEventId', () => {
    it('should fetch participants for an event with labels', async () => {
      const { supabase } = await import('@/lib/supabase');

      // Mock for fetching participants
      const mockFromParticipants = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockParticipantsList,
          error: null,
        }),
      });

      // Mock for fetching participant labels
      const mockFromParticipantLabels = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            { participant_id: 'participant-123', labels: mockLabel },
            { participant_id: 'participant-456', labels: mockLabel },
          ],
          error: null,
        }),
      });

      vi.mocked(supabase.from)
        .mockImplementationOnce(() => mockFromParticipants() as unknown as MockSupabaseQueryBuilder)
        .mockImplementationOnce(
          () => mockFromParticipantLabels() as unknown as MockSupabaseQueryBuilder
        );

      const result = await participantService.getParticipantsByEventId('event-123');

      expect(result).toHaveLength(3);
      expect(result[0].labels).toHaveLength(1);
      expect(result[1].labels).toHaveLength(1);
      expect(result[2].labels).toHaveLength(0);
    });

    it('should return empty array when no participants found', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await participantService.getParticipantsByEventId('event-123');
      expect(result).toEqual([]);
    });

    it('should handle database error', async () => {
      const { supabase } = await import('@/lib/supabase');
      const error = new Error('Database error');
      vi.mocked(supabase.from).mockImplementation(
        () =>
          ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: null,
              error,
            }),
          }) as unknown as MockSupabaseQueryBuilder
      );

      await expect(participantService.getParticipantsByEventId('event-123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('getParticipantById', () => {
    it('should fetch a single participant by ID', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockParticipant,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await participantService.getParticipantById('participant-123');
      expect(result.id).toBe('participant-123');
      expect(result.name).toBe('John Doe');
    });
  });

  describe('createParticipant', () => {
    it('should create a new participant', async () => {
      const { supabase } = await import('@/lib/supabase');
      const newParticipant = { ...mockParticipant };
      delete (newParticipant as Partial<typeof mockParticipant>).id;
      delete (newParticipant as Partial<typeof mockParticipant>).created_at;
      delete (newParticipant as Partial<typeof mockParticipant>).labels;

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockParticipant,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await participantService.createParticipant(newParticipant);
      expect(result.id).toBe('participant-123');
    });
  });

  describe('updateParticipant', () => {
    it('should update a participant', async () => {
      const { supabase } = await import('@/lib/supabase');
      const updates = { name: 'Jane Doe' };
      const updatedParticipant = { ...mockParticipant, ...updates };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: updatedParticipant,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await participantService.updateParticipant('participant-123', updates);
      expect(result.name).toBe('Jane Doe');
    });
  });

  describe('deleteParticipant', () => {
    it('should delete a participant', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      await expect(participantService.deleteParticipant('participant-123')).resolves.not.toThrow();
    });
  });

  describe('bulkDeleteParticipants', () => {
    it('should delete multiple participants', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const ids = ['participant-123', 'participant-456'];
      await expect(participantService.bulkDeleteParticipants(ids)).resolves.not.toThrow();
    });
  });

  describe('getParticipantByUserAndEvent', () => {
    it('should fetch participant by user and event', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockParticipant,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await participantService.getParticipantByUserAndEvent('user-123', 'event-123');
      expect(result).toBeTruthy();
      expect(result?.id).toBe('participant-123');
    });

    it('should return null when participant not found', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await participantService.getParticipantByUserAndEvent('user-999', 'event-999');
      expect(result).toBeNull();
    });
  });

  describe('addLabelToParticipant', () => {
    it('should add label to participant', async () => {
      const { supabase } = await import('@/lib/supabase');

      // First mock: check existing
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      // Second mock: insert
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      await expect(
        participantService.addLabelToParticipant('participant-123', 'label-123')
      ).resolves.not.toThrow();
    });

    it('should skip if label already exists', async () => {
      const { supabase } = await import('@/lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'existing-label' },
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      await expect(
        participantService.addLabelToParticipant('participant-123', 'label-123')
      ).resolves.not.toThrow();
    });
  });

  describe('removeLabelFromParticipant', () => {
    it('should remove label from participant', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      await expect(
        participantService.removeLabelFromParticipant('participant-123', 'label-123')
      ).resolves.not.toThrow();
    });
  });

  describe('exportParticipantsToCSV', () => {
    it('should export participants to CSV', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const clickSpy = vi.fn();
      createElementSpy.mockReturnValue({ click: clickSpy } as unknown as HTMLAnchorElement);

      const customFields = [
        { id: 'field1', label: 'Custom Field 1', type: 'text' as const, required: false },
      ];

      participantService.exportParticipantsToCSV(mockParticipantsList, 'Test Event', customFields);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(clickSpy).toHaveBeenCalled();
    });
  });
});
