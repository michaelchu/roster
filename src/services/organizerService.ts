import { supabase } from '@/lib/supabase';

export interface Organizer {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

export const organizerService = {
  async getOrganizerById(organizerId: string): Promise<Organizer | null> {
    const { data, error } = await supabase.rpc('get_user_profile', {
      user_id: organizerId,
    });

    if (error) {
      console.error('Error fetching organizer:', error);
      return null;
    }

    // RPC returns an array, get first result
    if (!data || data.length === 0) {
      return null;
    }

    return data[0];
  },

  async getOrganizerDisplayName(organizerId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_user_display_name', {
      user_id: organizerId,
    });

    if (error) {
      console.error('Error fetching organizer display name:', error);
      return 'Unknown';
    }

    return data || 'Unknown';
  },
};
