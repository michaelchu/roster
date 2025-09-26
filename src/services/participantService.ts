import { supabase } from '@/lib/supabase';

export interface Participant {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes?: string | null;
  user_id?: string | null;
  responses: Record<string, any>;
  created_at: string;
  labels?: Label[];
}

export interface Label {
  id: string;
  event_id?: string;
  name: string;
  color: string;
}

export interface ParticipantLabel {
  id: string;
  participant_id: string;
  label_id: string;
  created_at: string;
}

export const participantService = {
  async getParticipantsByEventId(eventId: string) {
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (participantsError) throw participantsError;

    if (!participants || participants.length === 0) return [];

    const participantIds = participants.map((p) => p.id);
    const { data: participantLabels } = await supabase
      .from('participant_labels')
      .select('*, labels(*)')
      .in('participant_id', participantIds);

    const labelMap =
      participantLabels?.reduce(
        (acc, pl) => {
          if (!acc[pl.participant_id]) {
            acc[pl.participant_id] = [];
          }
          if (pl.labels) {
            acc[pl.participant_id].push(pl.labels);
          }
          return acc;
        },
        {} as Record<string, Label[]>
      ) || {};

    return participants.map((p) => ({
      ...p,
      labels: labelMap[p.id] || [],
    }));
  },

  async getParticipantById(participantId: string) {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (error) throw error;
    return data;
  },

  async createParticipant(participant: Omit<Participant, 'id' | 'created_at' | 'labels'>) {
    const { data, error } = await supabase
      .from('participants')
      .insert(participant)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateParticipant(participantId: string, updates: Partial<Participant>) {
    const { data, error } = await supabase
      .from('participants')
      .update(updates)
      .eq('id', participantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteParticipant(participantId: string) {
    const { error } = await supabase.from('participants').delete().eq('id', participantId);

    if (error) throw error;
  },

  async bulkDeleteParticipants(participantIds: string[]) {
    const { error } = await supabase.from('participants').delete().in('id', participantIds);

    if (error) throw error;
  },

  async getParticipantByUserAndEvent(userId: string, eventId: string) {
    const { data } = await supabase
      .from('participants')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single();

    return data;
  },

  async addLabelToParticipant(participantId: string, labelId: string) {
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

  async removeLabelFromParticipant(participantId: string, labelId: string) {
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
    customFields: any[]
  ) {
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
          row.push(response || '');
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
