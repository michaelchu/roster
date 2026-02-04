import { supabase } from '@/lib/supabase';
import { logError } from '@/lib/errorHandler';

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
const TABLE_NAME = 'participant_activity_log';

/** Helper to insert activity log entry */
async function insertActivity(
  participantId: string | null,
  eventId: string,
  activityType: ParticipantActivityType,
  participantName: string,
  details: Record<string, unknown>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(TABLE_NAME).insert({
    participant_id: participantId,
    event_id: eventId,
    activity_type: activityType,
    participant_name: participantName,
    details,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(TABLE_NAME)
      .select('*')
      .eq('participant_id', participantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as ParticipantActivity[];
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
