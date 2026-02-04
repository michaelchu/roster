import { supabase } from '@/lib/supabase';
import { logError } from '@/lib/errorHandler';

/** Organizer profile information from auth.users */
export interface Organizer {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

export const organizerService = {
  /**
   * Retrieves organizer profile by user ID via RPC.
   * Fetches from auth.users through a security definer function.
   * @param organizerId - UUID of the organizer
   * @returns Organizer profile or null if not found
   */
  async getOrganizerById(organizerId: string): Promise<Organizer | null> {
    const { data, error } = await supabase.rpc('get_user_profile', {
      user_id: organizerId,
    });

    if (error) {
      logError('Error fetching organizer', error, { organizerId });
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0];
  },

  /**
   * Gets the display name for an organizer.
   * Returns the user's full name or email prefix via RPC.
   * @param organizerId - UUID of the organizer
   * @returns Display name string, or 'Unknown' if not found
   */
  async getOrganizerDisplayName(organizerId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_user_display_name', {
      user_id: organizerId,
    });

    if (error) {
      logError('Error fetching organizer display name', error, { organizerId });
      return 'Unknown';
    }

    return data || 'Unknown';
  },
};
