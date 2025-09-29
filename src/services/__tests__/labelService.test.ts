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

import { labelService } from '../labelService';
import { supabase } from '@/lib/supabase';

const mockSupabase = vi.mocked(supabase);

describe('labelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLabelsByEventId', () => {
    it('should fetch all labels for an event', async () => {
      const mockLabels = [
        {
          id: 'label-1',
          event_id: 'event-1',
          name: 'VIP',
          color: '#FF0000',
        },
        {
          id: 'label-2',
          event_id: 'event-1',
          name: 'Speaker',
          color: '#00FF00',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockLabels, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await labelService.getLabelsByEventId('event-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('labels');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('event_id', 'event-1');
      expect(mockQueryChain.order).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockLabels);
    });

    it('should return empty array when no labels found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await labelService.getLabelsByEventId('event-1');

      expect(result).toEqual([]);
    });

    it('should throw error when query fails', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(labelService.getLabelsByEventId('event-1')).rejects.toThrow();
    });
  });

  describe('createLabel', () => {
    it('should create a new label', async () => {
      const newLabel = {
        event_id: 'event-1',
        name: 'VIP',
        color: '#FF0000',
      };

      const mockCreatedLabel = {
        id: 'label-1',
        ...newLabel,
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedLabel, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await labelService.createLabel(newLabel);

      expect(mockSupabase.from).toHaveBeenCalledWith('labels');
      expect(mockQueryChain.insert).toHaveBeenCalledWith({
        event_id: 'event-1',
        name: 'VIP',
        color: '#FF0000',
      });
      expect(result).toEqual(mockCreatedLabel);
    });

    it('should throw error when creation fails', async () => {
      const newLabel = {
        event_id: 'event-1',
        name: 'VIP',
        color: '#FF0000',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(labelService.createLabel(newLabel)).rejects.toThrow();
    });

    it('should throw error when no data returned after creation', async () => {
      const newLabel = {
        event_id: 'event-1',
        name: 'VIP',
        color: '#FF0000',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(labelService.createLabel(newLabel)).rejects.toThrow('Failed to create label');
    });
  });

  describe('updateLabel', () => {
    it('should update label name', async () => {
      const updates = { name: 'Updated VIP' };

      const mockUpdatedLabel = {
        id: 'label-1',
        event_id: 'event-1',
        name: 'Updated VIP',
        color: '#FF0000',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedLabel, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await labelService.updateLabel('label-1', updates);

      expect(mockSupabase.from).toHaveBeenCalledWith('labels');
      expect(mockQueryChain.update).toHaveBeenCalledWith({ name: 'Updated VIP' });
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'label-1');
      expect(result).toEqual(mockUpdatedLabel);
    });

    it('should update label color', async () => {
      const updates = { color: '#00FF00' };

      const mockUpdatedLabel = {
        id: 'label-1',
        event_id: 'event-1',
        name: 'VIP',
        color: '#00FF00',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedLabel, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await labelService.updateLabel('label-1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith({ color: '#00FF00' });
      expect(result).toEqual(mockUpdatedLabel);
    });

    it('should update both name and color', async () => {
      const updates = {
        name: 'Updated VIP',
        color: '#0000FF',
      };

      const mockUpdatedLabel = {
        id: 'label-1',
        event_id: 'event-1',
        name: 'Updated VIP',
        color: '#0000FF',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedLabel, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await labelService.updateLabel('label-1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith({
        name: 'Updated VIP',
        color: '#0000FF',
      });
      expect(result).toEqual(mockUpdatedLabel);
    });

    it('should handle empty updates object', async () => {
      const updates = {};

      const mockUpdatedLabel = {
        id: 'label-1',
        event_id: 'event-1',
        name: 'VIP',
        color: '#FF0000',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedLabel, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await labelService.updateLabel('label-1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith({});
      expect(result).toEqual(mockUpdatedLabel);
    });

    it('should throw error when update fails', async () => {
      const updates = { name: 'Updated VIP' };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(labelService.updateLabel('label-1', updates)).rejects.toThrow();
    });

    it('should throw error when no data returned after update', async () => {
      const updates = { name: 'Updated VIP' };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(labelService.updateLabel('label-1', updates)).rejects.toThrow(
        'Failed to update label'
      );
    });
  });

  describe('deleteLabel', () => {
    it('should delete a label by ID', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await labelService.deleteLabel('label-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('labels');
      expect(mockQueryChain.delete).toHaveBeenCalled();
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'label-1');
    });

    it('should throw error when delete fails', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(labelService.deleteLabel('label-1')).rejects.toThrow();
    });
  });
});
