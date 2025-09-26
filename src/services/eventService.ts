import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate, CustomField, Json } from '@/types/app.types';

// Extended Event type with additional computed properties and properly typed custom_fields
export interface Event extends Omit<Tables<'events'>, 'custom_fields'> {
  participant_count?: number;
  custom_fields: CustomField[];
}

export interface Label extends Tables<'labels'> {}

// Helper function to convert database event to our Event type
function dbEventToEvent(dbEvent: Tables<'events'>): Event {
  return {
    ...dbEvent,
    is_private: dbEvent.is_private ?? false,
    custom_fields: (dbEvent.custom_fields as unknown as CustomField[]) || [],
  };
}

export const eventService = {
  async getEventsByOrganizer(organizerId: string): Promise<Event[]> {
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

      return eventsData.map((event) => ({
        ...dbEventToEvent(event),
        participant_count: countMap[event.id] || 0,
      }));
    }

    return [];
  },

  async getEventById(eventId: string): Promise<Event> {
    const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();

    if (error) throw error;
    if (!data) throw new Error('Event not found');

    return dbEventToEvent(data);
  },

  async createEvent(event: Omit<Event, 'id' | 'created_at' | 'participant_count'>): Promise<Event> {
    const insertData: TablesInsert<'events'> = {
      organizer_id: event.organizer_id,
      name: event.name,
      description: event.description,
      datetime: event.datetime,
      location: event.location,
      is_private: event.is_private ?? false,
      custom_fields: event.custom_fields as unknown as Json,
      parent_event_id: event.parent_event_id,
      max_participants: event.max_participants,
    };

    const { data, error } = await supabase.from('events').insert(insertData).select().single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create event');

    return dbEventToEvent(data);
  },

  async updateEvent(eventId: string, updates: Partial<Event>): Promise<Event> {
    const updateData: TablesUpdate<'events'> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.datetime !== undefined) updateData.datetime = updates.datetime;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.is_private !== undefined) updateData.is_private = updates.is_private;
    if (updates.max_participants !== undefined)
      updateData.max_participants = updates.max_participants;
    if (updates.custom_fields !== undefined)
      updateData.custom_fields = updates.custom_fields as unknown as Json;

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to update event');

    return dbEventToEvent(data);
  },

  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', eventId);

    if (error) throw error;
  },

  async duplicateEvent(eventId: string, organizerId: string): Promise<Event> {
    const { data: originalEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError) throw fetchError;
    if (!originalEvent) throw new Error('Original event not found');

    const insertData: TablesInsert<'events'> = {
      organizer_id: organizerId,
      name: `${originalEvent.name} (Copy)`,
      description: originalEvent.description,
      datetime: originalEvent.datetime,
      location: originalEvent.location,
      custom_fields: originalEvent.custom_fields,
      parent_event_id: originalEvent.id,
      is_private: originalEvent.is_private,
      max_participants: originalEvent.max_participants,
    };

    const { data: newEvent, error: createError } = await supabase
      .from('events')
      .insert(insertData)
      .select()
      .single();

    if (createError) throw createError;
    if (!newEvent) throw new Error('Failed to duplicate event');

    const { data: labels } = await supabase.from('labels').select('*').eq('event_id', eventId);

    if (labels && labels.length > 0) {
      const labelInserts: TablesInsert<'labels'>[] = labels.map((label) => ({
        event_id: newEvent.id,
        name: label.name,
        color: label.color,
      }));

      await supabase.from('labels').insert(labelInserts);
    }

    return dbEventToEvent(newEvent);
  },

  async getPublicEvents(): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_private', false)
      .order('datetime', { ascending: true });

    if (error) throw error;

    return (data || []).map(dbEventToEvent);
  },
};
