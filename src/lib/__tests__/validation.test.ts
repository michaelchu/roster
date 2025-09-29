import { describe, it, expect } from 'vitest';
import {
  eventSchema,
  validateCustomFields,
  validateResponses,
  type CustomField,
} from '../validation';

describe('validation', () => {
  describe('eventSchema - custom datetime validation', () => {
    it('should accept valid ISO datetime format', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        datetime: '2024-12-31T18:00:00Z',
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should accept ISO datetime without timezone', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        datetime: '2024-12-31T18:00:00',
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should accept ISO datetime without seconds', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        datetime: '2024-12-31T18:00',
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should accept empty datetime', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        datetime: null,
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should reject invalid datetime format', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        datetime: 'not-a-date',
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid date format');
      }
    });
  });

  describe('eventSchema - max_participants business rule', () => {
    it('should accept valid participant count', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        max_participants: 50,
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should enforce minimum of 1 participant', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        max_participants: 0,
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 1');
      }
    });

    it('should enforce maximum of 100 participants', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        max_participants: 101,
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100 participants');
      }
    });

    it('should reject non-integer participant count', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        max_participants: 50.5,
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('whole number');
      }
    });

    it('should accept null max_participants', () => {
      const event = {
        organizer_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Event',
        max_participants: null,
      };

      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('validateCustomFields helper', () => {
    it('should return empty array for non-array input', () => {
      expect(validateCustomFields(null)).toEqual([]);
      expect(validateCustomFields(undefined)).toEqual([]);
      expect(validateCustomFields('string')).toEqual([]);
      expect(validateCustomFields(123)).toEqual([]);
      expect(validateCustomFields({})).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(validateCustomFields([])).toEqual([]);
    });

    it('should filter out invalid fields and keep valid ones', () => {
      const fields = [
        { label: 'Valid Field', type: 'text', required: false },
        { label: '', type: 'text', required: false }, // Invalid: empty label
        { label: 'Another Valid', type: 'email', required: true },
        { label: 'Test', type: 'invalid-type', required: false }, // Invalid: bad type
        { label: 'a'.repeat(101), type: 'text', required: false }, // Invalid: too long
      ];

      const result = validateCustomFields(fields);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Valid Field');
      expect(result[1].label).toBe('Another Valid');
    });

    it('should validate all field types', () => {
      const fields = [
        { label: 'Text', type: 'text', required: false },
        { label: 'Email', type: 'email', required: false },
        { label: 'Phone', type: 'tel', required: false },
        { label: 'Number', type: 'number', required: false },
        { label: 'Select', type: 'select', required: false, options: ['A', 'B'] },
      ];

      const result = validateCustomFields(fields);
      expect(result).toHaveLength(5);
    });

    it('should handle mixed valid and invalid fields', () => {
      const fields = [
        { label: 'Good', type: 'text', required: true },
        null,
        { label: 'Also Good', type: 'number', required: false },
        undefined,
        { label: 'Still Good', type: 'select', required: false, options: [] },
      ];

      const result = validateCustomFields(fields);
      expect(result).toHaveLength(3);
    });
  });

  describe('validateResponses helper', () => {
    it('should return empty object for invalid input', () => {
      const customFields: CustomField[] = [];
      expect(validateResponses(null, customFields)).toEqual({});
      expect(validateResponses(undefined, customFields)).toEqual({});
      expect(validateResponses('string', customFields)).toEqual({});
      expect(validateResponses(123, customFields)).toEqual({});
      expect(validateResponses([], customFields)).toEqual({});
    });

    it('should return empty object for empty custom fields', () => {
      const responses = { field1: 'value' };
      expect(validateResponses(responses, [])).toEqual({});
    });

    it('should validate responses against custom fields using field id', () => {
      const customFields: CustomField[] = [
        { id: 'field1', label: 'Name', type: 'text', required: true },
        { id: 'field2', label: 'Age', type: 'number', required: false },
      ];

      const responses = {
        field1: 'John Doe',
        field2: 25,
      };

      const result = validateResponses(responses, customFields);
      expect(result).toEqual({
        field1: 'John Doe',
        field2: 25,
      });
    });

    it('should validate responses against custom fields using label as fallback', () => {
      const customFields: CustomField[] = [
        { label: 'Name', type: 'text', required: true }, // No id
        { label: 'Age', type: 'number', required: false }, // No id
      ];

      const responses = {
        Name: 'Jane Doe',
        Age: 30,
      };

      const result = validateResponses(responses, customFields);
      expect(result).toEqual({
        Name: 'Jane Doe',
        Age: 30,
      });
    });

    it('should ignore responses not in custom fields', () => {
      const customFields: CustomField[] = [
        { id: 'field1', label: 'Name', type: 'text', required: true },
      ];

      const responses = {
        field1: 'John Doe',
        field2: 'Should be ignored',
        field3: 'Also ignored',
      };

      const result = validateResponses(responses, customFields);
      expect(result).toEqual({
        field1: 'John Doe',
      });
    });

    it('should filter out invalid response values', () => {
      const customFields: CustomField[] = [
        { id: 'field1', label: 'Name', type: 'text', required: true },
        { id: 'field2', label: 'Bio', type: 'text', required: false },
      ];

      const responses = {
        field1: 'John Doe',
        field2: 'a'.repeat(1001), // Too long (max 1000 chars)
      };

      const result = validateResponses(responses, customFields);
      expect(result).toEqual({
        field1: 'John Doe',
        // field2 should be filtered out due to length
      });
    });

    it('should handle string, number, and array response types', () => {
      const customFields: CustomField[] = [
        { id: 'field1', label: 'Name', type: 'text', required: true },
        { id: 'field2', label: 'Age', type: 'number', required: false },
        { id: 'field3', label: 'Tags', type: 'select', required: false },
      ];

      const responses = {
        field1: 'John Doe',
        field2: 42,
        field3: ['tag1', 'tag2'],
      };

      const result = validateResponses(responses, customFields);
      expect(result).toEqual({
        field1: 'John Doe',
        field2: 42,
        field3: ['tag1', 'tag2'],
      });
    });

    it('should skip undefined response values', () => {
      const customFields: CustomField[] = [
        { id: 'field1', label: 'Name', type: 'text', required: true },
        { id: 'field2', label: 'Age', type: 'number', required: false },
      ];

      const responses = {
        field1: 'John Doe',
        field2: undefined,
      };

      const result = validateResponses(responses, customFields);
      expect(result).toEqual({
        field1: 'John Doe',
        // field2 should not be included
      });
    });

    it('should validate array items with max length constraint', () => {
      const customFields: CustomField[] = [
        { id: 'field1', label: 'Options', type: 'select', required: false },
      ];

      const responses = {
        field1: ['valid', 'a'.repeat(101)], // Second item too long
      };

      const result = validateResponses(responses, customFields);
      // Should filter out the entire array if any item is invalid
      expect(result).toEqual({});
    });
  });
});
