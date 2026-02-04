import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/app.types';
import { throwIfSupabaseError, requireData } from '@/lib/errorHandler';

export type Label = Tables<'labels'>;

export const labelService = {
  /**
   * Retrieves all labels for an event, sorted alphabetically by name.
   * @param eventId - UUID of the event
   * @returns Array of labels for the event
   * @throws Error if database query fails
   */
  async getLabelsByEventId(eventId: string): Promise<Label[]> {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('event_id', eventId)
      .order('name');

    return throwIfSupabaseError({ data, error }) || [];
  },

  /**
   * Creates a new label for an event.
   * @param label - Label data without id (event_id, name, color)
   * @returns The created label with generated id
   * @throws Error if creation fails
   */
  async createLabel(label: Omit<Label, 'id'>): Promise<Label> {
    const insertData: TablesInsert<'labels'> = {
      event_id: label.event_id,
      name: label.name,
      color: label.color,
    };

    const { data, error } = await supabase.from('labels').insert(insertData).select().single();

    throwIfSupabaseError({ data, error });
    return requireData(data, 'create label');
  },

  /**
   * Updates an existing label with partial data.
   * @param labelId - UUID of the label to update
   * @param updates - Partial label data (name and/or color)
   * @returns The updated label
   * @throws Error if label not found or update fails
   */
  async updateLabel(labelId: string, updates: Partial<Label>): Promise<Label> {
    const updateData: TablesUpdate<'labels'> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.color !== undefined) updateData.color = updates.color;

    const { data, error } = await supabase
      .from('labels')
      .update(updateData)
      .eq('id', labelId)
      .select()
      .single();

    throwIfSupabaseError({ data, error });
    return requireData(data, 'update label');
  },

  /**
   * Deletes a label by ID. Cascades to participant_labels associations.
   * @param labelId - UUID of the label to delete
   * @throws Error if deletion fails
   */
  async deleteLabel(labelId: string): Promise<void> {
    const { data, error } = await supabase.from('labels').delete().eq('id', labelId);

    throwIfSupabaseError({ data, error });
  },
};
