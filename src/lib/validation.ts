import { z } from 'zod';

// Custom field validation
export const customFieldSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Field label is required').max(100, 'Field label must be less than 100 characters'),
  type: z.enum(['text', 'email', 'tel', 'number', 'select'], {
    message: 'Invalid field type'
  }),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

// Response validation
export const responseValueSchema = z.union([
  z.string().max(1000, 'Response must be less than 1000 characters'),
  z.number(),
  z.array(z.string().max(100, 'Option must be less than 100 characters'))
]);

export const responseRecordSchema = z.record(z.string(), responseValueSchema);

// Event validation
export const eventSchema = z.object({
  id: z.string().min(8).max(21).optional(), // Support nanoid (8-21 chars) and UUID (36 chars)
  organizer_id: z.string().uuid('Invalid organizer ID'), // Keep UUID for organizer (from Supabase auth)
  name: z.string()
    .min(1, 'Event name is required')
    .max(200, 'Event name must be less than 200 characters')
    .trim(),
  description: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .nullable()
    .optional(),
  datetime: z.string()
    .datetime('Invalid date format')
    .nullable()
    .optional(),
  location: z.string()
    .max(500, 'Location must be less than 500 characters')
    .nullable()
    .optional(),
  is_private: z.boolean().default(false),
  custom_fields: z.array(customFieldSchema).default([]),
  max_participants: z.number()
    .int('Max participants must be a whole number')
    .min(1, 'Must allow at least 1 participant')
    .max(10000, 'Maximum 10,000 participants allowed')
    .nullable()
    .optional(),
  parent_event_id: z.string().min(8).max(36).nullable().optional(), // Support nanoid and UUID
  created_at: z.string().datetime().optional(),
  participant_count: z.number().int().min(0).optional(),
});

// Participant validation
export const participantSchema = z.object({
  id: z.string().uuid().optional(), // Participants still use UUID from Supabase
  event_id: z.string().min(8).max(36), // Support both nanoid and UUID for events
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email must be less than 254 characters')
    .nullable()
    .optional(),
  phone: z.string()
    .regex(/^[+]?[0-9\s\-()]{0,20}$/, 'Invalid phone number format')
    .max(20, 'Phone number must be less than 20 characters')
    .nullable()
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .nullable()
    .optional(),
  user_id: z.string().uuid().nullable().optional(),
  responses: responseRecordSchema.default({}),
  created_at: z.string().datetime().optional(),
});

// Label validation
export const labelSchema = z.object({
  id: z.string().uuid().optional(), // Labels still use UUID from Supabase
  event_id: z.string().min(8).max(36), // Support both nanoid and UUID for events
  name: z.string()
    .min(1, 'Label name is required')
    .max(50, 'Label name must be less than 50 characters')
    .trim(),
  color: z.string()
    .regex(/^#[0-9a-fA-F]{6}$|^[a-z]+$/, 'Invalid color format')
    .default('#gray'),
});

// Organizer validation
export const organizerSchema = z.object({
  id: z.string().uuid('Invalid organizer ID'),
  name: z.string()
    .max(100, 'Name must be less than 100 characters')
    .nullable()
    .optional(),
  created_at: z.string().datetime().optional(),
});

// Form validation schemas for common operations
export const createEventFormSchema = eventSchema.omit({
  id: true,
  created_at: true,
  participant_count: true
});

export const updateEventFormSchema = createEventFormSchema.partial().extend({
  id: z.string().uuid('Invalid event ID')
});

export const createParticipantFormSchema = participantSchema.omit({
  id: true,
  created_at: true
});

export const updateParticipantFormSchema = createParticipantFormSchema.partial().extend({
  id: z.string().uuid('Invalid participant ID')
});

// Type exports for use in components
export type CustomField = z.infer<typeof customFieldSchema>;
export type ResponseRecord = z.infer<typeof responseRecordSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Participant = z.infer<typeof participantSchema>;
export type Label = z.infer<typeof labelSchema>;
export type Organizer = z.infer<typeof organizerSchema>;

export type CreateEventForm = z.infer<typeof createEventFormSchema>;
export type UpdateEventForm = z.infer<typeof updateEventFormSchema>;
export type CreateParticipantForm = z.infer<typeof createParticipantFormSchema>;
export type UpdateParticipantForm = z.infer<typeof updateParticipantFormSchema>;

// Validation helper functions
export const validateEvent = (data: unknown) => eventSchema.parse(data);
export const validateParticipant = (data: unknown) => participantSchema.parse(data);
export const validateLabel = (data: unknown) => labelSchema.parse(data);
export const validateOrganizer = (data: unknown) => organizerSchema.parse(data);

// Safe validation that returns results instead of throwing
export const safeValidateEvent = (data: unknown) => eventSchema.safeParse(data);
export const safeValidateParticipant = (data: unknown) => participantSchema.safeParse(data);
export const safeValidateLabel = (data: unknown) => labelSchema.safeParse(data);
export const safeValidateOrganizer = (data: unknown) => organizerSchema.safeParse(data);

// Custom field validation helper
export function validateCustomFields(fields: unknown): CustomField[] {
  if (!Array.isArray(fields)) {
    return [];
  }

  const validFields: CustomField[] = [];
  for (const field of fields) {
    const result = customFieldSchema.safeParse(field);
    if (result.success) {
      validFields.push(result.data);
    }
  }

  return validFields;
}

// Response validation helper
export function validateResponses(responses: unknown, customFields: CustomField[]): ResponseRecord {
  if (!responses || typeof responses !== 'object') {
    return {};
  }

  const validResponses: ResponseRecord = {};
  const responseObj = responses as Record<string, unknown>;

  for (const field of customFields) {
    const fieldKey = field.id || field.label;
    const response = responseObj[fieldKey];

    if (response !== undefined) {
      const result = responseValueSchema.safeParse(response);
      if (result.success) {
        validResponses[fieldKey] = result.data;
      }
    }
  }

  return validResponses;
}