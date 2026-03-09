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

// Mock session validator - must be hoisted
vi.mock('@/lib/sessionValidator', () => ({
  requireValidSession: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
  validateSession: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
}));

import { eventService } from '../eventService';
import { supabase } from '@/lib/supabase';

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  logError: vi.fn(),
  errorHandler: {
    fromSupabaseError: vi.fn((error) => new Error(error.message)),
  },
  throwIfSupabaseError: vi.fn((result) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }),
  requireData: vi.fn((data, operation) => {
    if (data === null || data === undefined) {
      throw new Error(`Failed to ${operation}`);
    }
    return data;
  }),
  ValidationError: class ValidationError extends Error {
    userMessage: string;
    constructor(message: string, userMessage: string) {
      super(message);
      this.userMessage = userMessage;
      this.name = 'ValidationError';
    }
  },
  fireAndForget: vi.fn(),
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

  // Note: Basic CRUD operations (getEventsByOrganizer, getEventById, updateEvent, deleteEvent, etc.)
  // are thin Supabase wrappers and should be tested via integration tests instead.
  // Only testing business logic here.

  describe('getEventsByOrganizer - participant counting logic', () => {
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

  // getEventById is a direct query - tested via integration tests

  describe('createEvent - data transformation', () => {
    it('should trim event name', async () => {
      const newEvent = {
        organizer_id: 'org-1',
        name: '  Test Event  ',
        description: 'Description',
        datetime: '2024-12-31T18:00:00Z',
        end_datetime: null,
        location: 'Test Location',
        is_paid: true,
        is_private: false,
        custom_fields: [],
        max_participants: 50,
        group_id: null,
        parent_event_id: null,
        cost_breakdown: null,
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

      await eventService.createEvent(newEvent);

      // Verify name was trimmed
      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Event',
        })
      );
    });

    it('should set is_private to false by default', async () => {
      const newEvent = {
        organizer_id: 'org-1',
        name: 'Test',
        description: null,
        datetime: null,
        end_datetime: null,
        location: null,
        is_paid: true,
        is_private: false,
        custom_fields: [],
        max_participants: null,
        group_id: null,
        parent_event_id: null,
        cost_breakdown: null,
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

      await eventService.createEvent(newEvent);

      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          is_private: false,
        })
      );
    });
  });

  // updateEvent, deleteEvent are direct Supabase operations - tested via integration tests

  describe('duplicateEvent', () => {
    it('should duplicate event with (Copy) suffix', async () => {
      const originalEvent = {
        id: 'event-1',
        name: 'Original Event',
        organizer_id: 'org-1',
        description: 'Description',
        datetime: '2024-12-31T18:00:00Z',
        end_datetime: null,
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

  // getPublicEvents, getEventsByParticipant are direct queries - tested via integration tests

  describe('saveCostBreakdown', () => {
    it('should compute total and per-person cost correctly', async () => {
      const items = [
        { label: 'Court rental', quantity: 1, cost: 200 },
        { label: 'Shuttlecocks', quantity: 3, cost: 30 },
      ];

      // Mock getEventById (called by updateEvent to track changes)
      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'event-1',
            name: 'Test',
            custom_fields: [],
            cost_breakdown: null,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      // Mock update
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'event-1',
            name: 'Test',
            custom_fields: [],
            cost_breakdown: {
              items,
              participant_count: 4,
              cost_per_person: 72.5,
            },
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getChain as any) // getEventById
        .mockReturnValueOnce(updateChain as any); // update

      await eventService.saveCostBreakdown('event-1', items, 4);

      // Total = 200 + 90 = 290, per person = 290/4 = 72.5
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          cost_breakdown: {
            items,
            participant_count: 4,
            cost_per_person: 72.5,
          },
        })
      );
    });

    it('should handle zero participants without divide-by-zero', async () => {
      const items = [{ label: 'Court', quantity: 1, cost: 100 }];

      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'event-1',
            name: 'Test',
            custom_fields: [],
            cost_breakdown: null,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'event-1',
            name: 'Test',
            custom_fields: [],
            cost_breakdown: { items, participant_count: 0, cost_per_person: 0 },
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getChain as any)
        .mockReturnValueOnce(updateChain as any);

      await eventService.saveCostBreakdown('event-1', items, 0);

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          cost_breakdown: expect.objectContaining({
            cost_per_person: 0,
            participant_count: 0,
          }),
        })
      );
    });

    it('should round per-person cost to 2 decimal places', async () => {
      const items = [{ label: 'Court', quantity: 1, cost: 100 }];

      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'event-1',
            name: 'Test',
            custom_fields: [],
            cost_breakdown: null,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'event-1',
            name: 'Test',
            custom_fields: [],
            cost_breakdown: { items, participant_count: 3, cost_per_person: 33.33 },
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getChain as any)
        .mockReturnValueOnce(updateChain as any);

      await eventService.saveCostBreakdown('event-1', items, 3);

      // 100/3 = 33.333... should round to 33.33
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          cost_breakdown: expect.objectContaining({
            cost_per_person: 33.33,
          }),
        })
      );
    });
  });
});
