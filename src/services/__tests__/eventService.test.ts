/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  },
}));

import { eventService } from '../eventService';
import { supabase } from '@/lib/supabase';

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    fromSupabaseError: vi.fn((error) => new Error(error.message)),
  },
}));

// Mock validation
vi.mock('@/lib/validation', () => ({
  safeValidateEvent: vi.fn(() => ({ success: true, data: {} })),
  validateCustomFields: vi.fn((fields) => fields || []),
  ValidationError: class ValidationError extends Error {
    userMessage: string;
    constructor(message: string, userMessage: string) {
      super(message);
      this.userMessage = userMessage;
      this.name = 'ValidationError';
    }
  },
}));

const mockSupabase = vi.mocked(supabase);

describe('eventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEventsByOrganizer', () => {
    it('should fetch events for an organizer with participant counts', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Test Event',
          organizer_id: 'organizer-1',
          custom_fields: [],
          is_private: false,
          participants: [{ id: 'p1' }, { id: 'p2' }],
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await eventService.getEventsByOrganizer('organizer-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'event-1',
          name: 'Test Event',
          participant_count: 2,
        })
      );
    });

    it('should return empty array when no events found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await eventService.getEventsByOrganizer('organizer-1');

      expect(result).toEqual([]);
    });

    it('should correctly count participants filtering null values', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Test Event',
          organizer_id: 'organizer-1',
          custom_fields: [],
          participants: [{ id: 'p1' }, null, { id: 'p2' }, null],
          created_at: '2023-01-01',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.getEventsByOrganizer('organizer-1');

      expect(result[0].participant_count).toBe(2);
    });
  });

  describe('getEventById', () => {
    it('should fetch event by ID', async () => {
      const mockEvent = {
        id: 'event-1',
        name: 'Test Event',
        organizer_id: 'org-1',
        custom_fields: [],
        created_at: '2023-01-01',
      };

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.getEventById('event-1');

      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'event-1');
      expect(result.id).toBe('event-1');
    });

    it('should throw error when event not found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(eventService.getEventById('nonexistent')).rejects.toThrow('Event not found');
    });
  });

  describe('createEvent', () => {
    it('should create event with validation', async () => {
      const newEvent = {
        organizer_id: 'org-1',
        name: '  Test Event  ',
        description: 'Description',
        datetime: '2024-12-31T18:00:00Z',
        location: 'Test Location',
        is_private: false,
        custom_fields: [],
        max_participants: 50,
        group_id: null,
        parent_event_id: null,
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'event-1', ...newEvent, name: 'Test Event', created_at: '2023-01-01' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.createEvent(newEvent);

      // Verify name was trimmed
      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Event',
        })
      );
      expect(result.id).toBe('event-1');
    });

    it('should set is_private to false by default', async () => {
      const newEvent = {
        organizer_id: 'org-1',
        name: 'Test',
        description: null,
        datetime: null,
        location: null,
        custom_fields: [],
        max_participants: null,
        group_id: null,
        parent_event_id: null,
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'event-1', ...newEvent, is_private: false, created_at: '2023-01-01' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await eventService.createEvent(newEvent as any);

      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          is_private: false,
        })
      );
    });
  });

  describe('updateEvent', () => {
    it('should update event fields', async () => {
      const updates = {
        name: 'Updated Name',
        description: 'Updated description',
        datetime: '2025-01-01T12:00:00Z',
        is_private: true,
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'event-1', ...updates, custom_fields: [], created_at: '2023-01-01' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.updateEvent('event-1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
          is_private: true,
        })
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should handle partial updates', async () => {
      const updates = { name: 'Only Name Updated' };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'event-1',
            name: 'Only Name Updated',
            custom_fields: [],
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await eventService.updateEvent('event-1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith({ name: 'Only Name Updated' });
    });
  });

  describe('deleteEvent', () => {
    it('should delete event', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await eventService.deleteEvent('event-1');

      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'event-1');
    });

    it('should throw error on delete failure', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(eventService.deleteEvent('event-1')).rejects.toThrow();
    });
  });

  describe('duplicateEvent', () => {
    it('should duplicate event with (Copy) suffix', async () => {
      const originalEvent = {
        id: 'event-1',
        name: 'Original Event',
        organizer_id: 'org-1',
        description: 'Description',
        datetime: '2024-12-31T18:00:00Z',
        location: 'Location',
        custom_fields: [],
        is_private: false,
        max_participants: 50,
        group_id: null,
        created_at: '2023-01-01',
      };

      // Mock fetch original event
      const fetchChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: originalEvent, error: null }),
      };

      // Mock insert new event
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...originalEvent, id: 'event-2', name: 'Original Event (Copy)' },
          error: null,
        }),
      };

      // Mock labels query
      const labelsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(fetchChain as any)
        .mockReturnValueOnce(insertChain as any)
        .mockReturnValueOnce(labelsChain as any);

      const result = await eventService.duplicateEvent('event-1', 'org-1');

      expect(result.name).toBe('Original Event (Copy)');
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Original Event (Copy)',
          parent_event_id: 'event-1',
        })
      );
    });

    it('should copy labels from original event', async () => {
      const originalEvent = {
        id: 'event-1',
        name: 'Event',
        custom_fields: [],
        created_at: '2023-01-01',
      };

      const mockLabels = [
        { id: 'label-1', name: 'VIP', color: '#FF0000', event_id: 'event-1' },
        { id: 'label-2', name: 'Staff', color: '#00FF00', event_id: 'event-1' },
      ];

      const fetchChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: originalEvent, error: null }),
      };

      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...originalEvent, id: 'event-2', name: 'Event (Copy)' },
          error: null,
        }),
      };

      const labelsSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockLabels, error: null }),
      };

      const labelsInsertChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(fetchChain as any)
        .mockReturnValueOnce(insertChain as any)
        .mockReturnValueOnce(labelsSelectChain as any)
        .mockReturnValueOnce(labelsInsertChain as any);

      await eventService.duplicateEvent('event-1', 'org-1');

      expect(labelsInsertChain.insert).toHaveBeenCalledWith([
        { event_id: 'event-2', name: 'VIP', color: '#FF0000' },
        { event_id: 'event-2', name: 'Staff', color: '#00FF00' },
      ]);
    });
  });

  describe('getPublicEvents', () => {
    it('should fetch only public events', async () => {
      const mockEvents = [
        { id: 'event-1', name: 'Public Event', is_private: false, custom_fields: [] },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.getPublicEvents();

      expect(mockQueryChain.eq).toHaveBeenCalledWith('is_private', false);
      expect(mockQueryChain.order).toHaveBeenCalledWith('datetime', { ascending: true });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no public events', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.getPublicEvents();

      expect(result).toEqual([]);
    });
  });

  describe('getEventsByParticipant', () => {
    it('should fetch events where user is participant', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Event I Joined',
          custom_fields: [],
          participants: [{ id: 'p1' }],
          created_at: '2023-01-01',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.getEventsByParticipant('user-1');

      expect(mockQueryChain.eq).toHaveBeenCalledWith('participants.user_id', 'user-1');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when user has no events', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.getEventsByParticipant('user-1');

      expect(result).toEqual([]);
    });
  });
});
