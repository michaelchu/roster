import { supabase } from '@/lib/supabase';

export interface Organizer {
  id: string;
  name: string | null;
  created_at: string;
}

export const organizerService = {
  async getOrganizerById(organizerId: string) {
    const { data, error } = await supabase
      .from('organizers')
      .select('*')
      .eq('id', organizerId)
      .single();

    if (error) throw error;
    return data;
  },

  async createOrganizer(organizer: Omit<Organizer, 'created_at'>) {
    const { data, error } = await supabase.from('organizers').insert(organizer).select().single();

    if (error) throw error;
    return data;
  },

  async updateOrganizer(organizerId: string, updates: Partial<Organizer>) {
    const { data, error } = await supabase
      .from('organizers')
      .update(updates)
      .eq('id', organizerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async ensureOrganizerExists(userId: string, userName?: string | null) {
    const { data: existingOrganizer } = await supabase
      .from('organizers')
      .select('*')
      .eq('id', userId)
      .single();

    if (!existingOrganizer) {
      const { data, error } = await supabase
        .from('organizers')
        .insert({
          id: userId,
          name: userName,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    return existingOrganizer;
  },
};
