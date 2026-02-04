import { supabase } from '@/lib/supabase';

export type ParticipantActivityType =
  | 'joined'
  | 'withdrew'
  | 'payment_updated'
  | 'info_updated'
  | 'label_added'
  | 'label_removed';

export interface ParticipantActivity {
  id: string;
  participant_id: string | null; // Null when participant has been deleted
  event_id: string;
  activity_type: ParticipantActivityType;
  participant_name: string;
  details: Record<string, unknown>;
  created_at: string;
}

// TODO: Remove cast once Database types are regenerated after migration
const TABLE_NAME = 'participant_activity_log' as unknown as 'participants';

export const participantActivityService = {
  /**
   * Get all activity for an event (for event-wide activity view)
   */
  async getEventActivity(eventId: string, limit = 100): Promise<ParticipantActivity[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as ParticipantActivity[];
  },

  /**
   * Get activity history for a single participant
   */
  async getParticipantActivity(participantId: string, limit = 50): Promise<ParticipantActivity[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('participant_id', participantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as ParticipantActivity[];
  },
};
