import { supabase } from '@/lib/supabase';

export interface Event {
  id: string;
  organizer_id: string;
  name: string;
  description: string | null;
  datetime: string | null;
  location: string | null;
  is_private: boolean;
  custom_fields: any[];
  created_at: string;
  parent_event_id: string | null;
  participant_count?: number;
  max_participants?: number | null;
}

export interface Label {
  id: string;
  event_id: string;
  name: string;
  color: string;
}

export const eventService = {
  async getEventsByOrganizer(organizerId: string) {
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false });

    if (eventsError) throw eventsError;

    if (eventsData && eventsData.length > 0) {
      const eventIds = eventsData.map((e) => e.id);
      const { data: participantCounts } = await supabase
        .from('participants')
        .select('event_id')
        .in('event_id', eventIds);

      const countMap =
        participantCounts?.reduce(
          (acc, p) => {
            acc[p.event_id] = (acc[p.event_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

      const eventsWithCounts = eventsData.map((event) => ({
        ...event,
        participant_count: countMap[event.id] || 0,
      }));

      return eventsWithCounts;
    }

    return [];
  },

  async getEventById(eventId: string) {
    const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();

    if (error) throw error;
    return data;
  },

  async createEvent(event: Omit<Event, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('events').insert(event).select().single();

    if (error) throw error;
    return data;
  },

  async updateEvent(eventId: string, updates: Partial<Event>) {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEvent(eventId: string) {
    const { error } = await supabase.from('events').delete().eq('id', eventId);

    if (error) throw error;
  },

  async duplicateEvent(eventId: string, organizerId: string) {
    const { data: originalEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError) throw fetchError;

    const { data: newEvent, error: createError } = await supabase
      .from('events')
      .insert({
        organizer_id: organizerId,
        name: `${originalEvent.name} (Copy)`,
        description: originalEvent.description,
        datetime: originalEvent.datetime,
        location: originalEvent.location,
        custom_fields: originalEvent.custom_fields,
        parent_event_id: originalEvent.id,
      })
      .select()
      .single();

    if (createError) throw createError;

    const { data: labels } = await supabase.from('labels').select('*').eq('event_id', eventId);

    if (labels && labels.length > 0) {
      await supabase.from('labels').insert(
        labels.map((label) => ({
          event_id: newEvent.id,
          name: label.name,
          color: label.color,
        }))
      );
    }

    return newEvent;
  },

  async getPublicEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_private', false)
      .order('datetime', { ascending: true });

    if (error) throw error;
    return data || [];
  },
};
