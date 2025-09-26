import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/app.types';

export interface Organizer extends Tables<'organizers'> {}

export const organizerService = {
  async getOrganizerById(organizerId: string): Promise<Organizer | null> {
    const { data, error } = await supabase
      .from('organizers')
      .select('*')
      .eq('id', organizerId)
      .single();

    if (error) {
      console.error('Error fetching organizer:', error);
      return null;
    }
    return data;
  },

  async createOrganizer(organizer: Omit<Organizer, 'created_at'>): Promise<Organizer> {
    const insertData: TablesInsert<'organizers'> = {
      id: organizer.id,
      name: organizer.name,
    };

    const { data, error } = await supabase.from('organizers').insert(insertData).select().single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create organizer');

    return data;
  },

  async updateOrganizer(organizerId: string, updates: Partial<Organizer>): Promise<Organizer> {
    const updateData: TablesUpdate<'organizers'> = {};

    if (updates.name !== undefined) updateData.name = updates.name;

    const { data, error } = await supabase
      .from('organizers')
      .update(updateData)
      .eq('id', organizerId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to update organizer');

    return data;
  },

  async ensureOrganizerExists(userId: string, name?: string | null): Promise<void> {
    const existing = await organizerService.getOrganizerById(userId);
    if (!existing) {
      await organizerService.createOrganizer({
        id: userId,
        name: name || null,
      });
    }
  },
};
