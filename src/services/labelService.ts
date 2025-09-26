import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/app.types';

export type Label = Tables<'labels'>;

export const labelService = {
  async getLabelsByEventId(eventId: string): Promise<Label[]> {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('event_id', eventId)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createLabel(label: Omit<Label, 'id'>): Promise<Label> {
    const insertData: TablesInsert<'labels'> = {
      event_id: label.event_id,
      name: label.name,
      color: label.color,
    };

    const { data, error } = await supabase.from('labels').insert(insertData).select().single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create label');

    return data;
  },

  async updateLabel(labelId: string, updates: Partial<Label>): Promise<Label> {
    const updateData: TablesUpdate<'labels'> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.color !== undefined) updateData.color = updates.color;

    const { data, error } = await supabase
      .from('labels')
      .update(updateData)
      .eq('id', labelId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to update label');

    return data;
  },

  async deleteLabel(labelId: string): Promise<void> {
    const { error } = await supabase.from('labels').delete().eq('id', labelId);

    if (error) throw error;
  },
};
