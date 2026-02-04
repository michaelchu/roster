import { supabase } from '@/lib/supabase';
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  ResponseRecord,
  CustomField,
  Json,
} from '@/types/app.types';
import { throwIfSupabaseError, requireData } from '@/lib/errorHandler';
import { notificationService } from './notificationService';
import { participantActivityService } from './participantActivityService';

/** Extended Participant type with labels and computed properties */
export interface Participant extends Omit<Tables<'participants'>, 'responses' | 'created_at'> {
  created_at: string;
  labels?: Label[];
  responses: ResponseRecord;
  slot_number: number;
  claimed_by_user_id: string | null;
  payment_status: 'pending' | 'paid' | 'waived';
  payment_marked_at: string | null;
  payment_notes: string | null;
  avatar_url?: string | null;
  /** Current name from auth.users for linked user accounts */
  auth_full_name?: string | null;
}

export type Label = Tables<'labels'>;

export type ParticipantLabel = Tables<'participant_labels'>;

/**
 * Converts a database participant record to the application Participant type.
 * Applies default values for nullable fields.
 * @param dbParticipant - Raw participant record from the database
 * @returns Typed Participant object with defaults applied
 */
function dbParticipantToParticipant(dbParticipant: Tables<'participants'>): Participant {
  return {
    ...dbParticipant,
    created_at: dbParticipant.created_at || new Date().toISOString(),
    responses: (dbParticipant.responses as ResponseRecord) || {},
    slot_number: dbParticipant.slot_number || 0,
    claimed_by_user_id: dbParticipant.claimed_by_user_id || null,
    payment_status: (dbParticipant.payment_status as 'pending' | 'paid' | 'waived') || 'pending',
    payment_marked_at: dbParticipant.payment_marked_at || null,
    payment_notes: dbParticipant.payment_notes || null,
  };
}

/**
 * Generates a unique claim name for a user registering multiple spots.
 * Format: "UserName - N" where N increments for each additional claim.
 * @param userId - UUID of the user claiming spots
 * @param eventId - UUID of the event
 * @param userName - Display name of the user
 * @returns Generated claim name (e.g., "John Doe - 2")
 */
async function generateClaimName(
  userId: string,
  eventId: string,
  userName: string
): Promise<string> {
  const safeName = userName?.trim() || 'User';

  const { data: existingClaims } = await supabase
    .from('participants')
    .select('name')
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (!existingClaims) return `${safeName} - 1`;

  const claimPattern = new RegExp(`^${safeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} - (\\d+)$`);
  const claimNumbers = existingClaims
    .map((p) => {
      const match = p.name?.match(claimPattern);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((num) => num > 0);

  const nextClaimNumber = claimNumbers.length > 0 ? Math.max(...claimNumbers) + 1 : 1;
  return `${safeName} - ${nextClaimNumber}`;
}

/** Helper to get event info needed for notifications */
async function getEventInfo(eventId: string): Promise<{
  id: string;
  name: string;
  organizer_id: string;
  max_participants: number | null;
} | null> {
  const { data } = await supabase
    .from('events')
    .select('id, name, organizer_id, max_participants')
    .eq('id', eventId)
    .single();
  return data;
}

/** Helper to count participants for capacity check */
async function getParticipantCount(eventId: string): Promise<number> {
  const { count } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  return count || 0;
}

export const participantService = {
  /**
   * Retrieves all participants for an event with their labels and avatar URLs.
   * Uses JOINs to fetch labels and an RPC call to get user avatars.
   * @param eventId - UUID of the event
   * @returns Participants sorted by slot_number, with labels and avatar_url populated
   * @throws Error if database query fails
   */
  async getParticipantsByEventId(eventId: string): Promise<Participant[]> {
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select(
        `
        *,
        participant_labels!left(
          labels!inner(*)
        )
      `
      )
      .eq('event_id', eventId)
      .order('slot_number', { ascending: true });

    const data = throwIfSupabaseError({ data: participants, error: participantsError });

    if (!data || data.length === 0) return [];

    const { data: userInfoData } = await supabase.rpc('get_event_participants_with_avatar', {
      p_event_id: eventId,
    });

    const avatarMap = new Map<string, string | null>();
    const nameMap = new Map<string, string | null>();
    if (userInfoData) {
      for (const item of userInfoData) {
        avatarMap.set(item.participant_id, item.avatar_url);
        nameMap.set(item.participant_id, item.full_name);
      }
    }

    return data.map((p) => {
      const labels: Label[] = [];
      if (Array.isArray(p.participant_labels)) {
        for (const pl of p.participant_labels) {
          if (pl.labels) {
            labels.push(pl.labels as Label);
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { participant_labels: _, ...participantWithoutLabels } = p as Tables<'participants'> & {
        participant_labels: Array<{ labels: Label } | null>;
      };

      return {
        ...dbParticipantToParticipant(participantWithoutLabels),
        labels,
        responses: (participantWithoutLabels.responses as ResponseRecord) || {},
        avatar_url: avatarMap.get(p.id) || null,
        auth_full_name: nameMap.get(p.id) || null,
      };
    });
  },

  /**
   * Retrieves a single participant by ID.
   * @param participantId - UUID of the participant
   * @returns The participant record
   * @throws Error if participant not found
   */
  async getParticipantById(participantId: string): Promise<Participant> {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .single();

    throwIfSupabaseError({ data, error });
    return dbParticipantToParticipant(requireData(data, 'get participant'));
  },

  /**
   * Creates a new participant registration.
   * Handles both self-registration and claiming spots for others.
   * slot_number is auto-assigned by database trigger.
   * @param participant - Participant data without id, created_at, labels, or slot_number
   * @param options - Optional claiming options for registering on behalf of others
   * @param options.claimingUserId - UUID of user claiming the spot (sets claimed_by_user_id)
   * @param options.claimingUserName - Name for generating claim names
   * @param options.claimingUserEmail - Email for claimed spots
   * @returns The created participant with assigned slot_number
   * @throws Error if insertion fails
   */
  async createParticipant(
    participant: Omit<Participant, 'id' | 'created_at' | 'labels' | 'slot_number'>,
    options?: {
      targetSlotNumber?: number;
      claimingUserId?: string;
      claimingUserName?: string;
      claimingUserEmail?: string;
    }
  ): Promise<Participant> {
    let finalName = participant.name?.trim();

    if (!finalName && options?.claimingUserId && options?.claimingUserName) {
      finalName = await generateClaimName(
        options.claimingUserId,
        participant.event_id,
        options.claimingUserName
      );
    }

    if (!finalName || finalName.trim().length === 0) {
      if (options?.claimingUserName) {
        finalName = `${options.claimingUserName} - Guest`;
      } else {
        finalName = 'Guest';
      }
    }

    let finalEmail = participant.email || null;
    if (options?.claimingUserId && options?.claimingUserEmail) {
      finalEmail = options.claimingUserEmail;
    }

    const insertData = {
      event_id: participant.event_id,
      name: finalName,
      email: finalEmail,
      phone: participant.phone || null,
      notes: participant.notes || null,
      user_id: options?.claimingUserId ? null : participant.user_id,
      claimed_by_user_id: options?.claimingUserId || null,
      responses: participant.responses as Json,
    } as TablesInsert<'participants'>;

    const { data, error } = await supabase
      .from('participants')
      .insert(insertData)
      .select()
      .single();

    throwIfSupabaseError({ data, error });
    const created = dbParticipantToParticipant(requireData(data, 'create participant'));

    // Queue notifications and log activity (fire and forget - don't block on these)
    const eventInfo = await getEventInfo(participant.event_id);
    if (eventInfo) {
      const actorUserId = created.user_id || created.claimed_by_user_id;

      // Log activity
      participantActivityService
        .logJoined({
          participantId: created.id,
          eventId: created.event_id,
          participantName: created.name || 'Unknown',
          slotNumber: created.slot_number,
          claimedByUserId: created.claimed_by_user_id,
        })
        .catch((e) => console.error('Failed to log joined activity:', e));

      // Notify organizer of new signup
      notificationService
        .queueNewSignup({
          organizerId: eventInfo.organizer_id,
          eventId: eventInfo.id,
          eventName: eventInfo.name,
          participantId: created.id,
          participantName: created.name || 'Unknown',
          actorUserId,
        })
        .catch((e) => console.error('Failed to queue new signup notification:', e));

      // Notify participant of confirmation (if they have a user account)
      if (actorUserId) {
        notificationService
          .queueSignupConfirmed({
            participantUserId: actorUserId,
            organizerId: eventInfo.organizer_id,
            eventId: eventInfo.id,
            eventName: eventInfo.name,
            participantId: created.id,
          })
          .catch((e) => console.error('Failed to queue signup confirmed notification:', e));
      }

      // Check if capacity reached and notify
      if (eventInfo.max_participants) {
        const count = await getParticipantCount(participant.event_id);
        if (count === eventInfo.max_participants) {
          notificationService
            .queueCapacityReached({
              organizerId: eventInfo.organizer_id,
              eventId: eventInfo.id,
              eventName: eventInfo.name,
              maxParticipants: eventInfo.max_participants,
            })
            .catch((e) => console.error('Failed to queue capacity reached notification:', e));
        }
      }
    }

    return created;
  },

  /**
   * Updates an existing participant with partial data.
   * @param participantId - UUID of the participant to update
   * @param updates - Partial participant data to apply
   * @returns The updated participant
   * @throws Error if participant not found or update fails
   */
  async updateParticipant(
    participantId: string,
    updates: Partial<Participant>
  ): Promise<Participant> {
    // Get old data first to track changes
    const oldParticipant = await this.getParticipantById(participantId);

    const updateData: TablesUpdate<'participants'> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email || null;
    if (updates.phone !== undefined) updateData.phone = updates.phone || null;
    if (updates.notes !== undefined) updateData.notes = updates.notes || null;
    if (updates.responses !== undefined) updateData.responses = updates.responses as Json;

    const { data, error } = await supabase
      .from('participants')
      .update(updateData)
      .eq('id', participantId)
      .select()
      .single();

    throwIfSupabaseError({ data, error });
    const updated = dbParticipantToParticipant(requireData(data, 'update participant'));

    // Log info changes (fire and forget)
    const changes: {
      name?: { from: string | null; to: string | null };
      email?: { from: string | null; to: string | null };
      phone?: { from: string | null; to: string | null };
      notes?: { from: string | null; to: string | null };
    } = {};

    if (oldParticipant.name !== updated.name) {
      changes.name = { from: oldParticipant.name, to: updated.name };
    }
    if (oldParticipant.email !== updated.email) {
      changes.email = { from: oldParticipant.email, to: updated.email };
    }
    if (oldParticipant.phone !== updated.phone) {
      changes.phone = { from: oldParticipant.phone, to: updated.phone };
    }
    if (oldParticipant.notes !== updated.notes) {
      changes.notes = { from: oldParticipant.notes, to: updated.notes };
    }

    if (Object.keys(changes).length > 0) {
      participantActivityService
        .logInfoUpdated({
          participantId: updated.id,
          eventId: updated.event_id,
          participantName: updated.name || 'Unknown',
          changes,
        })
        .catch((e) => console.error('Failed to log info updated activity:', e));
    }

    return updated;
  },

  /**
   * Deletes a participant by ID.
   * @param participantId - UUID of the participant to delete
   * @throws Error if deletion fails
   */
  async deleteParticipant(participantId: string): Promise<void> {
    // Get participant and event info BEFORE deleting
    const participant = await this.getParticipantById(participantId);
    const eventInfo = await getEventInfo(participant.event_id);

    // Log withdrawal activity BEFORE deleting
    participantActivityService
      .logWithdrew({
        participantId: participant.id,
        eventId: participant.event_id,
        participantName: participant.name || 'Unknown',
        slotNumber: participant.slot_number,
        paymentStatus: participant.payment_status,
      })
      .catch((e) => console.error('Failed to log withdrew activity:', e));

    const { data, error } = await supabase.from('participants').delete().eq('id', participantId);

    throwIfSupabaseError({ data, error });

    // Queue withdrawal notification AFTER successful delete
    if (eventInfo) {
      const actorUserId = participant.user_id || participant.claimed_by_user_id;
      notificationService
        .queueWithdrawal({
          organizerId: eventInfo.organizer_id,
          eventId: eventInfo.id,
          eventName: eventInfo.name,
          participantName: participant.name || 'Unknown',
          actorUserId,
        })
        .catch((e) => console.error('Failed to queue withdrawal notification:', e));
    }
  },

  /**
   * Deletes multiple participants in a single operation.
   * @param participantIds - Array of participant UUIDs to delete
   * @throws Error if deletion fails
   */
  async bulkDeleteParticipants(participantIds: string[]): Promise<void> {
    const { data, error } = await supabase.from('participants').delete().in('id', participantIds);

    throwIfSupabaseError({ data, error });
  },

  /**
   * Finds a participant by user ID and event ID.
   * Useful for checking if a user is already registered for an event.
   * @param userId - UUID of the user
   * @param eventId - UUID of the event
   * @returns The participant if found, null otherwise
   */
  async getParticipantByUserAndEvent(userId: string, eventId: string): Promise<Participant | null> {
    const { data } = await supabase
      .from('participants')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single();

    if (!data) return null;

    return dbParticipantToParticipant(data);
  },

  /**
   * Adds a label to a participant. Idempotent - no error if already assigned.
   * @param participantId - UUID of the participant
   * @param labelId - UUID of the label to add
   * @throws Error if insertion fails (except for duplicates)
   */
  async addLabelToParticipant(participantId: string, labelId: string): Promise<void> {
    const { error } = await supabase.from('participant_labels').insert({
      participant_id: participantId,
      label_id: labelId,
    });

    // Ignore duplicate key errors (label already assigned)
    if (error && error.code !== '23505') throw error;

    // Log activity if insert succeeded (not a duplicate)
    if (!error) {
      // Fetch participant and label info for logging
      const [participant, labelResult] = await Promise.all([
        this.getParticipantById(participantId),
        supabase.from('labels').select('name').eq('id', labelId).single(),
      ]);

      if (labelResult.data) {
        participantActivityService
          .logLabelAdded({
            participantId,
            eventId: participant.event_id,
            participantName: participant.name || 'Unknown',
            labelId,
            labelName: labelResult.data.name,
          })
          .catch((e) => console.error('Failed to log label added activity:', e));
      }
    }
  },

  /**
   * Removes a label from a participant.
   * @param participantId - UUID of the participant
   * @param labelId - UUID of the label to remove
   * @throws Error if deletion fails
   */
  async removeLabelFromParticipant(participantId: string, labelId: string): Promise<void> {
    // Fetch participant and label info BEFORE deleting for logging
    const [participant, labelResult] = await Promise.all([
      this.getParticipantById(participantId),
      supabase.from('labels').select('name').eq('id', labelId).single(),
    ]);

    const { data, error } = await supabase
      .from('participant_labels')
      .delete()
      .eq('participant_id', participantId)
      .eq('label_id', labelId);

    throwIfSupabaseError({ data, error });

    // Log activity after successful delete
    if (labelResult.data) {
      participantActivityService
        .logLabelRemoved({
          participantId,
          eventId: participant.event_id,
          participantName: participant.name || 'Unknown',
          labelId,
          labelName: labelResult.data.name,
        })
        .catch((e) => console.error('Failed to log label removed activity:', e));
    }
  },

  /**
   * Exports participants to a downloadable CSV file.
   * Includes standard fields plus custom field responses.
   * @param participants - Array of participants to export
   * @param eventName - Event name used for the filename
   * @param customFields - Custom field definitions for column headers
   */
  async exportParticipantsToCSV(
    participants: Participant[],
    eventName: string,
    customFields: CustomField[]
  ): Promise<void> {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Notes',
      'Payment Status',
      'Payment Date',
      'Payment Notes',
      'Labels',
    ];

    customFields?.forEach((field) => {
      headers.push(field.label);
    });

    const rows = participants.map((p) => {
      const row = [
        p.name,
        p.email || '',
        p.phone || '',
        p.notes || '',
        p.payment_status || 'pending',
        p.payment_marked_at ? new Date(p.payment_marked_at).toLocaleDateString() : '',
        p.payment_notes || '',
        p.labels?.map((l) => l.name).join(', ') || '',
      ];

      customFields?.forEach((field) => {
        const response = p.responses?.[field.id || field.label];
        if (Array.isArray(response)) {
          row.push(response.join(', '));
        } else {
          row.push(String(response || ''));
        }
      });

      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eventName.replace(/[^a-z0-9]/gi, '_')}_participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Updates the payment status for a single participant.
   * @param participantId - UUID of the participant
   * @param paymentStatus - New payment status
   * @param paymentNotes - Optional notes about the payment
   * @returns The updated participant
   * @throws Error if update fails
   */
  async updatePaymentStatus(
    participantId: string,
    paymentStatus: 'pending' | 'paid' | 'waived',
    paymentNotes?: string
  ): Promise<Participant> {
    // Get old participant data to track changes
    const oldParticipant = await this.getParticipantById(participantId);
    const oldStatus = oldParticipant.payment_status;

    const updateData: TablesUpdate<'participants'> = {
      payment_status: paymentStatus,
      payment_marked_at: paymentStatus !== 'pending' ? new Date().toISOString() : null,
      payment_notes: paymentNotes || null,
    };

    const { data, error } = await supabase
      .from('participants')
      .update(updateData)
      .eq('id', participantId)
      .select()
      .single();

    throwIfSupabaseError({ data, error });
    const updated = dbParticipantToParticipant(requireData(data, 'update payment status'));

    // Log payment status change if it actually changed
    if (oldStatus !== paymentStatus) {
      participantActivityService
        .logPaymentUpdated({
          participantId: updated.id,
          eventId: updated.event_id,
          participantName: updated.name || 'Unknown',
          fromStatus: oldStatus,
          toStatus: paymentStatus,
        })
        .catch((e) => console.error('Failed to log payment updated activity:', e));

      // Queue payment_received notification if status became 'paid'
      if (paymentStatus === 'paid') {
        const eventInfo = await getEventInfo(updated.event_id);
        if (eventInfo) {
          notificationService
            .queuePaymentReceived({
              organizerId: eventInfo.organizer_id,
              eventId: eventInfo.id,
              eventName: eventInfo.name,
              participantId: updated.id,
              participantName: updated.name || 'Unknown',
              actorUserId: updated.user_id || updated.claimed_by_user_id,
            })
            .catch((e) => console.error('Failed to queue payment received notification:', e));
        }
      }
    }

    return updated;
  },

  /**
   * Updates payment status for multiple participants atomically via RPC.
   * @param participantIds - Array of participant UUIDs
   * @param paymentStatus - New payment status to apply
   * @param paymentNotes - Optional notes about the payment
   * @returns Count of updated vs requested participants
   * @throws Error if RPC call fails
   */
  async bulkUpdatePaymentStatus(
    participantIds: string[],
    paymentStatus: 'pending' | 'paid' | 'waived',
    paymentNotes?: string
  ): Promise<{ updated: number; requested: number }> {
    if (participantIds.length === 0) {
      return { updated: 0, requested: 0 };
    }

    // Fetch old participant data to track changes
    const { data: oldParticipants } = await supabase
      .from('participants')
      .select('id, name, event_id, user_id, claimed_by_user_id, payment_status')
      .in('id', participantIds);

    const oldStatusMap = new Map(oldParticipants?.map((p) => [p.id, p.payment_status]) || []);

    const { data, error } = await supabase.rpc('bulk_update_payment_status', {
      p_participant_ids: participantIds,
      p_payment_status: paymentStatus,
      p_payment_notes: paymentNotes,
    });

    throwIfSupabaseError({ data, error });

    if (!data || data.length === 0) {
      return { updated: 0, requested: participantIds.length };
    }

    // Log activity and send notifications for each updated participant
    if (oldParticipants) {
      // Group participants by event for efficient event info lookup
      const eventIds = [...new Set(oldParticipants.map((p) => p.event_id))];
      const eventInfoMap = new Map<string, Awaited<ReturnType<typeof getEventInfo>>>();

      for (const eventId of eventIds) {
        const eventInfo = await getEventInfo(eventId);
        if (eventInfo) {
          eventInfoMap.set(eventId, eventInfo);
        }
      }

      for (const participant of oldParticipants) {
        const oldStatus = oldStatusMap.get(participant.id);

        // Only process if status actually changed
        if (oldStatus !== paymentStatus) {
          // Log payment activity
          participantActivityService
            .logPaymentUpdated({
              participantId: participant.id,
              eventId: participant.event_id,
              participantName: participant.name || 'Unknown',
              fromStatus: oldStatus || 'pending',
              toStatus: paymentStatus,
            })
            .catch((e) => console.error('Failed to log bulk payment updated activity:', e));

          // Queue payment_received notification if status became 'paid'
          if (paymentStatus === 'paid') {
            const eventInfo = eventInfoMap.get(participant.event_id);
            if (eventInfo) {
              notificationService
                .queuePaymentReceived({
                  organizerId: eventInfo.organizer_id,
                  eventId: eventInfo.id,
                  eventName: eventInfo.name,
                  participantId: participant.id,
                  participantName: participant.name || 'Unknown',
                  actorUserId: participant.user_id || participant.claimed_by_user_id,
                })
                .catch((e) =>
                  console.error('Failed to queue bulk payment received notification:', e)
                );
            }
          }
        }
      }
    }

    return {
      updated: data[0].updated_count,
      requested: data[0].requested_count,
    };
  },

  /**
   * Gets payment statistics for an event.
   * @param eventId - UUID of the event
   * @returns Counts of total, paid, pending, and waived participants
   */
  async getPaymentSummary(eventId: string): Promise<{
    total: number;
    paid: number;
    pending: number;
    waived: number;
  }> {
    const participants = await this.getParticipantsByEventId(eventId);

    return {
      total: participants.length,
      paid: participants.filter((p) => p.payment_status === 'paid').length,
      pending: participants.filter((p) => p.payment_status === 'pending').length,
      waived: participants.filter((p) => p.payment_status === 'waived').length,
    };
  },

  /**
   * Gets payment statistics for multiple events in a single query.
   * @param eventIds - Array of event UUIDs
   * @returns Map of event ID to payment summary
   */
  async getPaymentSummariesBatch(
    eventIds: string[]
  ): Promise<Map<string, { total: number; paid: number; pending: number; waived: number }>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const { data: participants, error } = await supabase
      .from('participants')
      .select('event_id, payment_status')
      .in('event_id', eventIds);

    throwIfSupabaseError({ data: participants, error });

    const summaryMap = new Map<
      string,
      { total: number; paid: number; pending: number; waived: number }
    >();

    // Initialize all events with zero counts
    for (const eventId of eventIds) {
      summaryMap.set(eventId, { total: 0, paid: 0, pending: 0, waived: 0 });
    }

    // Aggregate counts from participants
    if (participants) {
      for (const p of participants) {
        const summary = summaryMap.get(p.event_id);
        if (summary) {
          summary.total++;
          const status = (p.payment_status as 'pending' | 'paid' | 'waived') || 'pending';
          summary[status]++;
        }
      }
    }

    return summaryMap;
  },

  /**
   * Creates multiple participants in batch, typically for adding group members to an event.
   * Handles duplicates gracefully by tracking them separately.
   * @param eventId - UUID of the event
   * @param members - Array of member data with name and optional user_id
   * @returns Counts of created, failed, and duplicate names
   */
  async createParticipantsBatch(
    eventId: string,
    members: Array<{ name: string; user_id?: string | null }>
  ): Promise<{ created: number; failed: number; duplicates: string[] }> {
    let created = 0;
    let failed = 0;
    const duplicates: string[] = [];

    for (const member of members) {
      try {
        await this.createParticipant({
          event_id: eventId,
          name: member.name,
          email: null,
          phone: null,
          notes: null,
          user_id: member.user_id || null,
          claimed_by_user_id: null,
          responses: {},
          payment_status: 'pending',
          payment_marked_at: null,
          payment_notes: null,
        });
        created++;
      } catch (error) {
        const pgError = error as { code?: string };
        if (pgError.code === '23505') {
          duplicates.push(member.name);
        }
        failed++;
      }
    }

    return { created, failed, duplicates };
  },
};
