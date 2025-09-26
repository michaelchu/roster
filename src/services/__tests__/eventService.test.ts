import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventService } from '../eventService';
import { mockEvent, mockEventsList, mockLabel } from '@/test/fixtures/events';

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
      const mockFromEvents = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockEventsList,
          error: null,
        }),
      });

      const mockFromParticipants = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ event_id: 'event-123' }, { event_id: 'event-123' }, { event_id: 'event-789' }],
          error: null,
        }),
      });

      vi.mocked(supabase.from)
        .mockImplementationOnce(() => mockFromEvents() as any)
        .mockImplementationOnce(() => mockFromParticipants() as any);

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
      } as any);

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
      } as any);

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
      } as any);

      const result = await eventService.getEventById('event-123');
      expect(result).toEqual(mockEvent);
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
      } as any);

      await expect(eventService.getEventById('nonexistent')).rejects.toThrow('Event not found');
    });
  });

  describe('createEvent', () => {
    it('should create a new event', async () => {
      const { supabase } = await import('@/lib/supabase');
      const newEvent = { ...mockEvent };
      delete (newEvent as any).id;
      delete (newEvent as any).created_at;

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEvent,
          error: null,
        }),
      } as any);

      const result = await eventService.createEvent(newEvent);
      expect(result).toEqual(mockEvent);
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event', async () => {
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
      } as any);

      const result = await eventService.updateEvent('event-123', updates);
      expect(result).toEqual(updatedEvent);
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
      } as any);

      await expect(eventService.deleteEvent('event-123')).resolves.not.toThrow();
    });
  });

  describe('duplicateEvent', () => {
    it('should duplicate an event with labels', async () => {
      const { supabase } = await import('@/lib/supabase');
      const duplicatedEvent = {
        ...mockEvent,
        id: 'new-event-id',
        name: 'Test Event (Copy)',
        parent_event_id: 'event-123',
      };

      // Mock getting original event
      const mockFromOriginal = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockEvent,
          error: null,
        }),
      });

      // Mock creating new event
      const mockFromCreate = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: duplicatedEvent,
          error: null,
        }),
      });

      // Mock getting labels
      const mockFromLabels = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockLabel],
          error: null,
        }),
      });

      // Mock inserting labels
      const mockFromInsertLabels = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      vi.mocked(supabase.from)
        .mockImplementationOnce(() => mockFromOriginal() as any)
        .mockImplementationOnce(() => mockFromCreate() as any)
        .mockImplementationOnce(() => mockFromLabels() as any)
        .mockImplementationOnce(() => mockFromInsertLabels() as any);

      const result = await eventService.duplicateEvent('event-123', 'org-123');
      expect(result).toEqual(duplicatedEvent);
    });
  });

  describe('getPublicEvents', () => {
    it('should fetch only public events', async () => {
      const { supabase } = await import('@/lib/supabase');
      const publicEvents = mockEventsList.filter((e) => !e.is_private);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: publicEvents,
          error: null,
        }),
      } as any);

      const result = await eventService.getPublicEvents();
      expect(result).toEqual(publicEvents);
      expect(result.every((e) => !e.is_private)).toBe(true);
    });
  });
});
