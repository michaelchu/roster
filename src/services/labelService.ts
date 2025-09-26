import { supabase } from '@/lib/supabase';

export interface Label {
  id: string;
  event_id: string;
  name: string;
  color: string;
}

export const labelService = {
  async getLabelsByEventId(eventId: string) {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('event_id', eventId)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createLabel(label: Omit<Label, 'id'>) {
    const { data, error } = await supabase.from('labels').insert(label).select().single();

    if (error) throw error;
    return data;
  },

  async updateLabel(labelId: string, updates: Partial<Label>) {
    const { data, error } = await supabase
      .from('labels')
      .update(updates)
      .eq('id', labelId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteLabel(labelId: string) {
    const { error } = await supabase.from('labels').delete().eq('id', labelId);

    if (error) throw error;
  },
};
