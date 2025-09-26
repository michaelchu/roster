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
}

export type Label = Tables<'labels'>;

export type ParticipantLabel = Tables<'participant_labels'>;

// Helper function to convert database participant to our Participant type
function dbParticipantToParticipant(dbParticipant: Tables<'participants'>): Participant {
  return {
    ...dbParticipant,
    created_at: dbParticipant.created_at || new Date().toISOString(),
    responses: (dbParticipant.responses as ResponseRecord) || {},
  };
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
      .order('created_at', { ascending: false });

    if (participantsError) throw errorHandler.fromSupabaseError(participantsError);

    if (!participants || participants.length === 0) return [];

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
    participant: Omit<Participant, 'id' | 'created_at' | 'labels'>
  ): Promise<Participant> {
    const insertData: TablesInsert<'participants'> = {
      event_id: participant.event_id,
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      notes: participant.notes,
      user_id: participant.user_id,
      responses: participant.responses as Json,
    };

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
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
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
    const headers = ['Name', 'Email', 'Phone', 'Notes', 'Labels'];

    customFields?.forEach((field) => {
      headers.push(field.label);
    });

    const rows = participants.map((p) => {
      const row = [
        p.name,
        p.email || '',
        p.phone || '',
        p.notes || '',
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
};
