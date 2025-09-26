import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventService } from '../eventService';
import { mockEvent, mockEventsList, mockLabel } from '@/test/fixtures/events';
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

describe('eventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEventsByOrganizer', () => {
    it('should fetch events for an organizer with participant counts', async () => {
      const { supabase } = await import('@/lib/supabase');

      // Mock events with joined participants data
      const eventsWithParticipants = [
        {
          ...mockEventsList[0],
          participants: [{ id: 'p1' }, { id: 'p2' }], // 2 participants
        },
        {
          ...mockEventsList[1],
          participants: [{ id: 'p3' }], // 1 participant
        },
        {
          ...mockEventsList[2],
          participants: [], // 0 participants
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: eventsWithParticipants,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await eventService.getEventsByOrganizer('org-123');

      expect(result).toHaveLength(3);
      expect(result[0].participant_count).toBe(2);
      expect(result[1].participant_count).toBe(1);
      expect(result[2].participant_count).toBe(0);
    });

    it('should return empty array when no events found', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await eventService.getEventsByOrganizer('org-123');
      expect(result).toEqual([]);
    });

    it('should throw error when fetch fails', async () => {
      const { supabase } = await import('@/lib/supabase');
      const error = new Error('Database error');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      await expect(eventService.getEventsByOrganizer('org-123')).rejects.toThrow('Database error');
    });
  });

  describe('getEventById', () => {
    it('should fetch a single event by ID', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEvent,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await eventService.getEventById('V1StGXR8_Z');
      expect(result.id).toBe('V1StGXR8_Z');
      expect(result.name).toBe('Test Event');
    });

    it('should throw error when event not found', async () => {
      const { supabase } = await import('@/lib/supabase');
      const error = new Error('Event not found');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      await expect(eventService.getEventById('nonexistent')).rejects.toThrow('Event not found');
    });
  });

  describe('createEvent', () => {
    it('should create a new event', async () => {
      const { supabase } = await import('@/lib/supabase');
      const newEvent = { ...mockEvent };
      delete (newEvent as Partial<typeof mockEvent>).id;
      delete (newEvent as Partial<typeof mockEvent>).created_at;
      delete (newEvent as Partial<typeof mockEvent>).participant_count;

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEvent,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await eventService.createEvent(newEvent);
      expect(result.id).toBe('V1StGXR8_Z');
    });
  });

  describe('updateEvent', () => {
    it('should update an event', async () => {
      const { supabase } = await import('@/lib/supabase');
      const updates = { name: 'Updated Event Name' };
      const updatedEvent = { ...mockEvent, ...updates };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: updatedEvent,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await eventService.updateEvent('event-123', updates);
      expect(result.name).toBe('Updated Event Name');
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', async () => {
      const { supabase } = await import('@/lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      await expect(eventService.deleteEvent('event-123')).resolves.not.toThrow();
    });
  });

  describe('duplicateEvent', () => {
    it('should duplicate an event with labels', async () => {
      const { supabase } = await import('@/lib/supabase');

      // Mock for fetching original event
      const mockFromOriginalEvent = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEvent,
          error: null,
        }),
      });

      // Mock for creating new event
      const mockFromCreateEvent = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockEvent, id: 'new-event-id', name: 'Test Event (Copy)' },
          error: null,
        }),
      });

      // Mock for fetching labels
      const mockFromLabels = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockLabel],
          error: null,
        }),
      });

      // Mock for inserting new labels
      const mockFromInsertLabels = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      vi.mocked(supabase.from)
        .mockImplementationOnce(
          () => mockFromOriginalEvent() as unknown as MockSupabaseQueryBuilder
        )
        .mockImplementationOnce(() => mockFromCreateEvent() as unknown as MockSupabaseQueryBuilder)
        .mockImplementationOnce(() => mockFromLabels() as unknown as MockSupabaseQueryBuilder)
        .mockImplementationOnce(
          () => mockFromInsertLabels() as unknown as MockSupabaseQueryBuilder
        );

      const result = await eventService.duplicateEvent('event-123', 'org-123');
      expect(result.id).toBe('new-event-id');
      expect(result.name).toBe('Test Event (Copy)');
    });
  });

  describe('getPublicEvents', () => {
    it('should fetch public events', async () => {
      const { supabase } = await import('@/lib/supabase');
      const publicEvents = mockEventsList.filter((e) => !e.is_private);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: publicEvents,
          error: null,
        }),
      } as unknown as MockSupabaseQueryBuilder);

      const result = await eventService.getPublicEvents();
      expect(result).toHaveLength(publicEvents.length);
      expect(result.every((e) => !e.is_private)).toBe(true);
    });
  });
});
