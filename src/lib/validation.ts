import { z } from 'zod';

/**
 * Creates a reusable datetime validator that accepts ISO strings or parseable dates.
 * @param errorMessage - Error message to display on validation failure
 * @returns Zod string schema with datetime validation
 */
const createDatetimeValidator = (errorMessage: string) => {
  return z
    .string()
    .refine((val) => {
      if (!val) return true; // Allow empty/null values
      // Accept ISO datetime strings (with or without timezone)
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;
      return isoRegex.test(val) || !isNaN(Date.parse(val));
    }, errorMessage)
    .nullable()
    .optional();
};

/** Schema for custom form field definitions */
export const customFieldSchema = z.object({
  id: z.string().optional(),
  label: z
    .string()
    .min(1, 'Field label is required')
    .max(100, 'Field label must be less than 100 characters'),
  type: z.enum(['text', 'email', 'tel', 'number', 'select'], {
    message: 'Invalid field type',
  }),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

/** Schema for custom field response values */
export const responseValueSchema = z.union([
  z.string().max(1000, 'Response must be less than 1000 characters'),
  z.number(),
  z.array(z.string().max(100, 'Option must be less than 100 characters')),
]);

/** Schema for response records (keyed by field ID) */
export const responseRecordSchema = z.record(z.string(), responseValueSchema);

/** Schema for event data validation */
export const eventSchema = z
  .object({
    id: z
      .string()
      .min(8)
      .max(12)
      .regex(/^[A-Za-z0-9_-]+$/, 'Invalid event ID format')
      .optional(),
    organizer_id: z.string().uuid('Invalid organizer ID'),
    name: z
      .string()
      .min(1, 'Event name is required')
      .max(200, 'Event name must be less than 200 characters')
      .trim(),
    description: z
      .string()
      .max(2000, 'Description must be less than 2000 characters')
      .nullable()
      .optional(),
    datetime: createDatetimeValidator('Invalid date format'),
    end_datetime: createDatetimeValidator('Invalid end date format'),
    location: z
      .string()
      .max(500, 'Location must be less than 500 characters')
      .nullable()
      .optional(),
    is_paid: z.boolean().default(true),
    is_private: z.boolean().default(false),
    custom_fields: z.array(customFieldSchema).default([]),
    max_participants: z
      .number()
      .int('Max participants must be a whole number')
      .min(2, 'Must allow at least 2 participants')
      .max(100, 'Maximum 100 participants allowed')
      .nullable()
      .optional(),
    group_id: z.string().nullable().optional(),
    parent_event_id: z
      .string()
      .min(8)
      .max(12)
      .regex(/^[A-Za-z0-9_-]+$/, 'Invalid parent event ID format')
      .nullable()
      .optional(),
    created_at: z.string().datetime().optional(),
    participant_count: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.datetime && data.end_datetime) {
        const startDate = new Date(data.datetime);
        const endDate = new Date(data.end_datetime);
        return endDate > startDate;
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['end_datetime'],
    }
  );

/** Schema for participant data validation */
export const participantSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z
    .string()
    .min(8)
    .max(12)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid event ID format'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  email: z
    .string()
    .email('Invalid email format')
    .max(254, 'Email must be less than 254 characters')
    .nullable()
    .optional(),
  phone: z
    .string()
    .regex(/^[+]?[0-9\s\-()]{0,20}$/, 'Invalid phone number format')
    .max(20, 'Phone number must be less than 20 characters')
    .nullable()
    .optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  responses: responseRecordSchema.default({}),
  created_at: z.string().datetime().optional(),
});

/** Schema for label data validation */
export const labelSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z
    .string()
    .min(8)
    .max(12)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid event ID format'),
  name: z
    .string()
    .min(1, 'Label name is required')
    .max(50, 'Label name must be less than 50 characters')
    .trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$|^[a-z]+$/, 'Invalid color format')
    .default('#gray'),
});

/** Schema for organizer data validation */
export const organizerSchema = z.object({
  id: z.string().uuid('Invalid organizer ID'),
  name: z.string().max(100, 'Name must be less than 100 characters').nullable().optional(),
  created_at: z.string().datetime().optional(),
});

/** Schema for creating a new event (without server-generated fields) */
export const createEventFormSchema = eventSchema.omit({
  id: true,
  created_at: true,
  participant_count: true,
});

/** Schema for updating an existing event (partial fields with required ID) */
export const updateEventFormSchema = createEventFormSchema.partial().extend({
  id: z
    .string()
    .min(8)
    .max(12)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid event ID format'),
});

/** Schema for creating a new participant */
export const createParticipantFormSchema = participantSchema.omit({
  id: true,
  created_at: true,
});

/** Schema for updating an existing participant */
export const updateParticipantFormSchema = createParticipantFormSchema.partial().extend({
  id: z.string().uuid('Invalid participant ID'),
});

/** Schema for user profile form */
export const profileFormSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be less than 100 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

/** Schema for group creation/edit form */
export const groupFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Group name is required')
    .max(200, 'Group name must be 200 characters or less'),
  description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
});

/** Schema for login form */
export const loginFormSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/** Schema for registration form */
export const registerFormSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/** Schema for new event form (date validations handled in component for runtime comparisons) */
export const newEventFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Event name is required')
    .max(200, 'Event name must be less than 200 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  datetime: z.string().optional(),
  end_datetime: z.string().optional(),
  location: z.string().max(500, 'Location must be less than 500 characters').optional(),
  is_paid: z.boolean(),
  is_private: z.boolean(),
  group_id: z.string(),
  datetimeTbd: z.boolean(),
  endDatetimeTbd: z.boolean(),
  locationTbd: z.boolean(),
});

// Type exports
export type ProfileFormData = z.infer<typeof profileFormSchema>;
export type GroupFormData = z.infer<typeof groupFormSchema>;
export type LoginFormData = z.infer<typeof loginFormSchema>;
export type RegisterFormData = z.infer<typeof registerFormSchema>;
export type NewEventFormData = z.infer<typeof newEventFormSchema>;
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

/** Validates event data, throws on failure */
export const validateEvent = (data: unknown) => eventSchema.parse(data);

/** Validates participant data, throws on failure */
export const validateParticipant = (data: unknown) => participantSchema.parse(data);

/** Validates label data, throws on failure */
export const validateLabel = (data: unknown) => labelSchema.parse(data);

/** Validates organizer data, throws on failure */
export const validateOrganizer = (data: unknown) => organizerSchema.parse(data);

/** Validates event data, returns SafeParseResult instead of throwing */
export const safeValidateEvent = (data: unknown) => eventSchema.safeParse(data);

/** Validates participant data, returns SafeParseResult instead of throwing */
export const safeValidateParticipant = (data: unknown) => participantSchema.safeParse(data);

/** Validates label data, returns SafeParseResult instead of throwing */
export const safeValidateLabel = (data: unknown) => labelSchema.safeParse(data);

/** Validates organizer data, returns SafeParseResult instead of throwing */
export const safeValidateOrganizer = (data: unknown) => organizerSchema.safeParse(data);

/**
 * Validates an array of custom field definitions.
 * Returns only valid fields, silently discarding invalid ones.
 * @param fields - Unknown input to validate
 * @returns Array of validated CustomField objects
 */
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

/**
 * Validates response data against custom field definitions.
 * Returns only valid responses matching the provided field definitions.
 * @param responses - Unknown response object to validate
 * @param customFields - Array of custom field definitions
 * @returns Validated ResponseRecord with only valid entries
 */
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
