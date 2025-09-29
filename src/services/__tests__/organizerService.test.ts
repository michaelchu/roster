import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  },
}));

import { organizerService } from '../organizerService';
import { supabase } from '@/lib/supabase';

const mockSupabase = vi.mocked(supabase);

describe('organizerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getOrganizerById', () => {
    it('should fetch organizer by ID', async () => {
      const mockOrganizer = {
        id: 'organizer-1',
        name: 'John Doe',
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockOrganizer, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.getOrganizerById('organizer-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('organizers');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'organizer-1');
      expect(result).toEqual(mockOrganizer);
    });

    it('should return null when organizer not found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.getOrganizerById('nonexistent');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error fetching organizer:', {
        message: 'Not found',
      });
    });

    it('should return null on database error', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.getOrganizerById('organizer-1');

      expect(result).toBeNull();
    });
  });

  describe('createOrganizer', () => {
    it('should create a new organizer with name', async () => {
      const newOrganizer = {
        id: 'organizer-1',
        name: 'John Doe',
      };

      const mockCreatedOrganizer = {
        ...newOrganizer,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedOrganizer, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.createOrganizer(newOrganizer);

      expect(mockSupabase.from).toHaveBeenCalledWith('organizers');
      expect(mockQueryChain.insert).toHaveBeenCalledWith({
        id: 'organizer-1',
        name: 'John Doe',
      });
      expect(result).toEqual(mockCreatedOrganizer);
    });

    it('should create organizer with null name', async () => {
      const newOrganizer = {
        id: 'organizer-1',
        name: null,
      };

      const mockCreatedOrganizer = {
        ...newOrganizer,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedOrganizer, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.createOrganizer(newOrganizer);

      expect(mockQueryChain.insert).toHaveBeenCalledWith({
        id: 'organizer-1',
        name: null,
      });
      expect(result).toEqual(mockCreatedOrganizer);
    });

    it('should throw error when creation fails', async () => {
      const newOrganizer = {
        id: 'organizer-1',
        name: 'John Doe',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(organizerService.createOrganizer(newOrganizer)).rejects.toThrow();
    });

    it('should throw error when no data returned', async () => {
      const newOrganizer = {
        id: 'organizer-1',
        name: 'John Doe',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(organizerService.createOrganizer(newOrganizer)).rejects.toThrow(
        'Failed to create organizer'
      );
    });
  });

  describe('updateOrganizer', () => {
    it('should update organizer name', async () => {
      const updates = { name: 'Jane Doe' };

      const mockUpdatedOrganizer = {
        id: 'organizer-1',
        name: 'Jane Doe',
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedOrganizer, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.updateOrganizer('organizer-1', updates);

      expect(mockSupabase.from).toHaveBeenCalledWith('organizers');
      expect(mockQueryChain.update).toHaveBeenCalledWith({ name: 'Jane Doe' });
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'organizer-1');
      expect(result).toEqual(mockUpdatedOrganizer);
    });

    it('should update organizer name to null', async () => {
      const updates = { name: null };

      const mockUpdatedOrganizer = {
        id: 'organizer-1',
        name: null,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedOrganizer, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.updateOrganizer('organizer-1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith({ name: null });
      expect(result).toEqual(mockUpdatedOrganizer);
    });

    it('should handle empty updates object', async () => {
      const updates = {};

      const mockUpdatedOrganizer = {
        id: 'organizer-1',
        name: 'John Doe',
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedOrganizer, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.updateOrganizer('organizer-1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith({});
      expect(result).toEqual(mockUpdatedOrganizer);
    });

    it('should throw error when update fails', async () => {
      const updates = { name: 'Jane Doe' };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(organizerService.updateOrganizer('organizer-1', updates)).rejects.toThrow();
    });

    it('should throw error when no data returned', async () => {
      const updates = { name: 'Jane Doe' };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(organizerService.updateOrganizer('organizer-1', updates)).rejects.toThrow(
        'Failed to update organizer'
      );
    });
  });

  describe('ensureOrganizerExists', () => {
    it('should create organizer if not exists', async () => {
      // Mock getOrganizerById to return null
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      // Mock createOrganizer
      const createQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1', name: 'John', created_at: '2023-01-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(createQueryChain as ReturnType<typeof mockSupabase.from>);

      await organizerService.ensureOrganizerExists('user-1', 'John');

      expect(createQueryChain.insert).toHaveBeenCalledWith({
        id: 'user-1',
        name: 'John',
      });
    });

    it('should not create organizer if already exists', async () => {
      // Mock getOrganizerById to return existing organizer
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1', name: 'John', created_at: '2023-01-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValueOnce(getQueryChain as ReturnType<typeof mockSupabase.from>);

      await organizerService.ensureOrganizerExists('user-1', 'John');

      // Should only call from once (for getOrganizerById)
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should handle null name parameter', async () => {
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      const createQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1', name: null, created_at: '2023-01-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(createQueryChain as ReturnType<typeof mockSupabase.from>);

      await organizerService.ensureOrganizerExists('user-1', null);

      expect(createQueryChain.insert).toHaveBeenCalledWith({
        id: 'user-1',
        name: null,
      });
    });

    it('should handle undefined name parameter', async () => {
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      const createQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1', name: null, created_at: '2023-01-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(createQueryChain as ReturnType<typeof mockSupabase.from>);

      await organizerService.ensureOrganizerExists('user-1');

      expect(createQueryChain.insert).toHaveBeenCalledWith({
        id: 'user-1',
        name: null,
      });
    });
  });
});
