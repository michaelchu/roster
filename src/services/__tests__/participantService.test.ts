import { describe, it, expect, vi, beforeEach } from 'vitest';
import { participantService } from '../participantService';
import { mockParticipant, mockLabel, mockEvent } from '@/test/fixtures/events';

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
    it('should fetch participants with labels', async () => {
      const { supabase } = await import('@/lib/supabase');
      const participants = [mockParticipant];

      // Mock fetching participants
      const mockFromParticipants = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: participants,
          error: null,
        }),
      });

      // Mock fetching participant labels
      const mockFromLabels = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              participant_id: mockParticipant.id,
              labels: mockLabel,
            },
          ],
          error: null,
        }),
      });

      vi.mocked(supabase.from)
        .mockImplementationOnce(() => mockFromParticipants() as any)
        .mockImplementationOnce(() => mockFromLabels() as any);

      const result = await participantService.getParticipantsByEventId('event-123');
      expect(result).toHaveLength(1);
      expect(result[0].labels).toHaveLength(1);
      expect(result[0].labels?.[0]).toEqual(mockLabel);
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
      } as any);

      const result = await participantService.getParticipantsByEventId('event-123');
      expect(result).toEqual([]);
    });
  });

  describe('createParticipant', () => {
    it('should create a new participant', async () => {
      const { supabase } = await import('@/lib/supabase');
      const newParticipant = { ...mockParticipant };
      delete (newParticipant as any).id;
      delete (newParticipant as any).created_at;
      delete (newParticipant as any).labels;

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockParticipant,
          error: null,
        }),
      } as any);

      const result = await participantService.createParticipant(newParticipant);
      expect(result).toEqual(mockParticipant);
    });
  });

  describe('updateParticipant', () => {
    it('should update participant details', async () => {
      const { supabase } = await import('@/lib/supabase');
      const updates = { name: 'Updated Name' };
      const updatedParticipant = { ...mockParticipant, ...updates };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: updatedParticipant,
          error: null,
        }),
      } as any);

      const result = await participantService.updateParticipant('participant-123', updates);
      expect(result.name).toBe('Updated Name');
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
      } as any);

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
      } as any);

      const ids = ['p1', 'p2', 'p3'];
      await expect(participantService.bulkDeleteParticipants(ids)).resolves.not.toThrow();
    });
  });

  describe('addLabelToParticipant', () => {
    it('should add a label to participant if not exists', async () => {
      const { supabase } = await import('@/lib/supabase');

      // Mock checking existing label
      const mockFromCheck = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null, // Label doesn't exist
          error: null,
        }),
      });

      // Mock inserting label
      const mockFromInsert = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      vi.mocked(supabase.from)
        .mockImplementationOnce(() => mockFromCheck() as any)
        .mockImplementationOnce(() => mockFromInsert() as any);

      await expect(
        participantService.addLabelToParticipant('participant-123', 'label-123')
      ).resolves.not.toThrow();
    });

    it('should not add label if it already exists', async () => {
      const { supabase } = await import('@/lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'existing-label' }, // Label exists
          error: null,
        }),
      } as any);

      await expect(
        participantService.addLabelToParticipant('participant-123', 'label-123')
      ).resolves.not.toThrow();
    });
  });

  describe('removeLabelFromParticipant', () => {
    it('should remove a label from participant', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as any);

      await expect(
        participantService.removeLabelFromParticipant('participant-123', 'label-123')
      ).resolves.not.toThrow();
    });
  });

  describe('exportParticipantsToCSV', () => {
    it('should export participants to CSV', () => {
      // Mock document.createElement and related methods
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValue(mockAnchor as any);
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const participants = [mockParticipant];
      participantService.exportParticipantsToCSV(
        participants,
        'Test Event',
        mockEvent.custom_fields
      );

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('Test_Event_participants.csv');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });
});
