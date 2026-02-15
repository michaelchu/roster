import { supabase } from '@/lib/supabase';
import { logError } from '@/lib/errorHandler';
import type { Tables, Json } from '@/types/supabase';

export type ParticipantActivityType =
  | 'joined'
  | 'withdrew'
  | 'payment_updated'
  | 'info_updated'
  | 'label_added'
  | 'label_removed';

export type ParticipantActivity = Tables<'participant_activity_log'> & {
  activity_type: ParticipantActivityType;
  details: Record<string, unknown>;
};

const TABLE_NAME = 'participant_activity_log' as const;

/** Helper to insert activity log entry via RPC (bypasses RLS for cross-user logging) */
async function insertActivity(
  participantId: string | null,
  eventId: string,
  activityType: ParticipantActivityType,
  participantName: string,
  details: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.rpc('log_participant_activity', {
    p_participant_id: participantId,
    p_event_id: eventId,
    p_activity_type: activityType,
    p_participant_name: participantName,
    p_details: details as Json,
  });

  if (error) {
    logError('Failed to log participant activity', error, { participantId, eventId, activityType });
  }
}

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
    return (data || []) as ParticipantActivity[];
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
    return (data || []) as ParticipantActivity[];
  },

  // ============================================================================
  // Activity Logging Functions (moved from DB triggers)
  // ============================================================================

  /**
   * Log when a participant joins an event
   */
  async logJoined(params: {
    participantId: string;
    eventId: string;
    participantName: string;
    slotNumber: number;
    claimedByUserId: string | null;
  }): Promise<void> {
    await insertActivity(params.participantId, params.eventId, 'joined', params.participantName, {
      slot_number: params.slotNumber,
      claimed_by_user_id: params.claimedByUserId,
    });
  },

  /**
   * Log when a participant withdraws from an event
   */
  async logWithdrew(params: {
    participantId: string;
    eventId: string;
    participantName: string;
    slotNumber: number;
    paymentStatus: string;
  }): Promise<void> {
    await insertActivity(params.participantId, params.eventId, 'withdrew', params.participantName, {
      slot_number: params.slotNumber,
      payment_status: params.paymentStatus,
    });
  },

  /**
   * Log when a participant's payment status changes
   */
  async logPaymentUpdated(params: {
    participantId: string;
    eventId: string;
    participantName: string;
    fromStatus: string;
    toStatus: string;
  }): Promise<void> {
    await insertActivity(
      params.participantId,
      params.eventId,
      'payment_updated',
      params.participantName,
      {
        from: params.fromStatus,
        to: params.toStatus,
      }
    );
  },

  /**
   * Log when a participant's info is updated
   */
  async logInfoUpdated(params: {
    participantId: string;
    eventId: string;
    participantName: string;
    changes: {
      name?: { from: string | null; to: string | null };
      email?: { from: string | null; to: string | null };
      phone?: { from: string | null; to: string | null };
      notes?: { from: string | null; to: string | null };
    };
  }): Promise<void> {
    const details: Record<string, unknown> = {};
    if (params.changes.name) details.name = params.changes.name;
    if (params.changes.email) details.email = params.changes.email;
    if (params.changes.phone) details.phone = params.changes.phone;
    if (params.changes.notes) details.notes = params.changes.notes;

    // Only log if there are actual changes
    if (Object.keys(details).length === 0) return;

    await insertActivity(
      params.participantId,
      params.eventId,
      'info_updated',
      params.participantName,
      details
    );
  },

  /**
   * Log when a label is added to a participant
   */
  async logLabelAdded(params: {
    participantId: string;
    eventId: string;
    participantName: string;
    labelId: string;
    labelName: string;
  }): Promise<void> {
    await insertActivity(
      params.participantId,
      params.eventId,
      'label_added',
      params.participantName,
      {
        label_id: params.labelId,
        label_name: params.labelName,
      }
    );
  },

  /**
   * Log when a label is removed from a participant
   */
  async logLabelRemoved(params: {
    participantId: string;
    eventId: string;
    participantName: string;
    labelId: string;
    labelName: string;
  }): Promise<void> {
    await insertActivity(
      params.participantId,
      params.eventId,
      'label_removed',
      params.participantName,
      {
        label_id: params.labelId,
        label_name: params.labelName,
      }
    );
  },
};
