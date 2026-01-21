import { supabase } from '@/lib/supabase';
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  ResponseRecord,
  CustomField,
  Json,
} from '@/types/app.types';
import { errorHandler } from '@/lib/errorHandler';

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
}

export type Label = Tables<'labels'>;

export type ParticipantLabel = Tables<'participant_labels'>;

// Helper function to convert database participant to our Participant type
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

// Helper function to generate claim name for a user
async function generateClaimName(
  userId: string,
  eventId: string,
  userName: string
): Promise<string> {
  // Ensure userName is valid
  const safeName = userName?.trim() || 'User';

  // Count existing participants claimed by this user (excluding their main registration)
  const { data: existingClaims } = await supabase
    .from('participants')
    .select('name')
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (!existingClaims) return `${safeName} - 1`;

  // Count claims that match the pattern "userName - #"
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

export const participantService = {
  async getParticipantsByEventId(eventId: string): Promise<Participant[]> {
    // Use a single query with JOIN to get participants with their labels
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

    if (participantsError) throw errorHandler.fromSupabaseError(participantsError);

    if (!participants || participants.length === 0) return [];

    // Fetch avatar URLs for participants with user_id
    const { data: avatarData } = await supabase.rpc('get_event_participants_with_avatar', {
      p_event_id: eventId,
    });

    // Create a map of participant_id to avatar_url
    const avatarMap = new Map<string, string | null>();
    if (avatarData) {
      for (const item of avatarData) {
        avatarMap.set(item.participant_id, item.avatar_url);
      }
    }

    return participants.map((p) => {
      // Extract labels from the joined data
      const labels: Label[] = [];
      if (Array.isArray(p.participant_labels)) {
        for (const pl of p.participant_labels) {
          if (pl.labels) {
            labels.push(pl.labels as Label);
          }
        }
      }

      // Remove the joined data from the participant object
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { participant_labels: _, ...participantWithoutLabels } = p as Tables<'participants'> & {
        participant_labels: Array<{ labels: Label } | null>;
      };

      return {
        ...dbParticipantToParticipant(participantWithoutLabels),
        labels,
        responses: (participantWithoutLabels.responses as ResponseRecord) || {},
        avatar_url: avatarMap.get(p.id) || null,
      };
    });
  },

  async getParticipantById(participantId: string): Promise<Participant> {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Participant not found');

    return dbParticipantToParticipant(data);
  },

  async createParticipant(
    participant: Omit<Participant, 'id' | 'created_at' | 'labels' | 'slot_number'>,
    options?: {
      targetSlotNumber?: number;
      claimingUserId?: string;
      claimingUserName?: string;
      claimingUserEmail?: string;
    }
  ): Promise<Participant> {
    // Generate claim name if name is empty and claiming options are provided
    let finalName = participant.name?.trim();

    if (!finalName && options?.claimingUserId && options?.claimingUserName) {
      finalName = await generateClaimName(
        options.claimingUserId,
        participant.event_id,
        options.claimingUserName
      );
    }

    // Ensure we always have a valid name (fallback for safety)
    if (!finalName || finalName.trim().length === 0) {
      if (options?.claimingUserName) {
        finalName = `${options.claimingUserName} - Guest`;
      } else {
        // For self-registrations, this should never happen since authentication is mandatory
        // But keep a fallback just in case
        finalName = 'Guest';
      }
    }

    // Determine email for the participant
    // When claiming a spot: use the claimer's email (allows multiple claims per user)
    // When self-registering: use the provided email
    let finalEmail = participant.email || null;
    if (options?.claimingUserId && options?.claimingUserEmail) {
      // Use claimer's email for claimed spots to satisfy group_participants constraint
      finalEmail = options.claimingUserEmail;
    }

    // Note: slot_number is NOT set here - it will be assigned by the database trigger
    // assign_participant_slot_trigger which calls get_next_slot_number
    // Using Partial to allow omitting slot_number despite it being required in the type
    const insertData = {
      event_id: participant.event_id,
      name: finalName,
      email: finalEmail,
      phone: participant.phone || null,
      notes: participant.notes || null,
      // For claimed spots: user_id = null, claimed_by_user_id = claimer
      // For self registration: user_id = user, claimed_by_user_id = null
      user_id: options?.claimingUserId ? null : participant.user_id,
      claimed_by_user_id: options?.claimingUserId || null,
      responses: participant.responses as Json,
      // slot_number omitted - will be assigned by database trigger before insert completes
    } as TablesInsert<'participants'>;

    const { data, error } = await supabase
      .from('participants')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create participant');

    return dbParticipantToParticipant(data);
  },

  async updateParticipant(
    participantId: string,
    updates: Partial<Participant>
  ): Promise<Participant> {
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

    if (error) throw error;
    if (!data) throw new Error('Failed to update participant');

    return dbParticipantToParticipant(data);
  },

  async deleteParticipant(participantId: string): Promise<void> {
    const { error } = await supabase.from('participants').delete().eq('id', participantId);

    if (error) throw error;
  },

  async bulkDeleteParticipants(participantIds: string[]): Promise<void> {
    const { error } = await supabase.from('participants').delete().in('id', participantIds);

    if (error) throw error;
  },

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

  async addLabelToParticipant(participantId: string, labelId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('participant_labels')
      .select('id')
      .eq('participant_id', participantId)
      .eq('label_id', labelId)
      .single();

    if (existing) return;

    const { error } = await supabase.from('participant_labels').insert({
      participant_id: participantId,
      label_id: labelId,
    });

    if (error) throw error;
  },

  async removeLabelFromParticipant(participantId: string, labelId: string): Promise<void> {
    const { error } = await supabase
      .from('participant_labels')
      .delete()
      .eq('participant_id', participantId)
      .eq('label_id', labelId);

    if (error) throw error;
  },

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

  async updatePaymentStatus(
    participantId: string,
    paymentStatus: 'pending' | 'paid' | 'waived',
    paymentNotes?: string
  ): Promise<Participant> {
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

    if (error) throw error;
    if (!data) throw new Error('Failed to update payment status');

    return dbParticipantToParticipant(data);
  },

  async bulkUpdatePaymentStatus(
    participantIds: string[],
    paymentStatus: 'pending' | 'paid' | 'waived',
    paymentNotes?: string
  ): Promise<{ updated: number; requested: number }> {
    if (participantIds.length === 0) {
      return { updated: 0, requested: 0 };
    }

    // Use RPC function for atomic update with validation
    const { data, error } = await supabase.rpc('bulk_update_payment_status', {
      p_participant_ids: participantIds,
      p_payment_status: paymentStatus,
      p_payment_notes: paymentNotes,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return { updated: 0, requested: participantIds.length };
    }

    return {
      updated: data[0].updated_count,
      requested: data[0].requested_count,
    };
  },

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
        // Check for unique constraint violation (PostgreSQL error code 23505)
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
