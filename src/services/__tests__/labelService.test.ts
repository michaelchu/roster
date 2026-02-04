/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase
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

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  logError: vi.fn(),
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

import { labelService } from '../labelService';
import { supabase } from '@/lib/supabase';

const mockSupabase = vi.mocked(supabase);

describe('labelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLabelsByEventId', () => {
    it('should fetch labels for an event ordered by name', async () => {
      const mockLabels = [
        { id: 'label-1', event_id: 'event-1', name: 'Attending', color: '#00ff00' },
        { id: 'label-2', event_id: 'event-1', name: 'VIP', color: '#ff0000' },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockLabels, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await labelService.getLabelsByEventId('event-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('labels');
      expect(mockQueryChain.select).toHaveBeenCalledWith('*');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('event_id', 'event-1');
      expect(mockQueryChain.order).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockLabels);
    });

    it('should return empty array when no labels exist', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await labelService.getLabelsByEventId('event-1');

      expect(result).toEqual([]);
    });

    it('should throw error when fetch fails', async () => {
      const mockError = new Error('Database error');
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(labelService.getLabelsByEventId('event-1')).rejects.toThrow('Database error');
    });
  });

  describe('createLabel', () => {
    it('should create a new label with correct data', async () => {
      const newLabel = {
        event_id: 'event-1',
        name: 'Premium',
        color: '#gold',
      };

      const createdLabel = {
        id: 'label-new',
        ...newLabel,
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdLabel, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await labelService.createLabel(newLabel);

      expect(mockSupabase.from).toHaveBeenCalledWith('labels');
      expect(mockQueryChain.insert).toHaveBeenCalledWith({
        event_id: 'event-1',
        name: 'Premium',
        color: '#gold',
      });
      expect(result).toEqual(createdLabel);
    });

    it('should throw error when insert fails', async () => {
      const mockError = new Error('Insert failed');
      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(
        labelService.createLabel({
          event_id: 'event-1',
          name: 'Test',
          color: '#000',
        })
      ).rejects.toThrow('Insert failed');
    });

    it('should throw error when no data returned', async () => {
      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(
        labelService.createLabel({
          event_id: 'event-1',
          name: 'Test',
          color: '#000',
        })
      ).rejects.toThrow("Operation 'create label' returned no data");
    });
  });

  describe('updateLabel', () => {
    // Note: Single test covers the update path - testing name-only vs color-only vs both
    // is redundant as they all pass through the same code path.
    it('should update label with provided fields', async () => {
      const updatedLabel = {
        id: 'label-1',
        event_id: 'event-1',
        name: 'New Name',
        color: '#0000ff',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedLabel, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await labelService.updateLabel('label-1', {
        name: 'New Name',
        color: '#0000ff',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('labels');
      expect(mockQueryChain.update).toHaveBeenCalledWith({
        name: 'New Name',
        color: '#0000ff',
      });
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'label-1');
      expect(result).toEqual(updatedLabel);
    });

    it('should throw error when update fails', async () => {
      const mockError = new Error('Update failed');
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(labelService.updateLabel('label-1', { name: 'Test' })).rejects.toThrow(
        'Update failed'
      );
    });

    it('should throw error when no data returned', async () => {
      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(labelService.updateLabel('label-1', { name: 'Test' })).rejects.toThrow(
        "Operation 'update label' returned no data"
      );
    });
  });

  describe('deleteLabel', () => {
    it('should delete a label by id', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await labelService.deleteLabel('label-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('labels');
      expect(mockQueryChain.delete).toHaveBeenCalled();
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'label-1');
    });

    it('should throw error when delete fails', async () => {
      const mockError = new Error('Delete failed');
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(labelService.deleteLabel('label-1')).rejects.toThrow('Delete failed');
    });
  });
});
