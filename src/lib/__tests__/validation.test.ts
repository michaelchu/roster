import { describe, it, expect } from 'vitest';
import {
  eventSchema,
  profileFormSchema,
  groupFormSchema,
  loginFormSchema,
  registerFormSchema,
  newEventFormSchema,
  validateCustomFields,
  validateResponses,
  type CustomField,
} from '../validation';

describe('validation', () => {
  // Keep one comprehensive test per schema to verify custom error messages
  describe('profileFormSchema', () => {
    it('should validate with custom error messages', () => {
      // Valid case
      expect(
        profileFormSchema.safeParse({ fullName: 'John', email: 'john@test.com' }).success
      ).toBe(true);

      // Empty name
      const emptyName = profileFormSchema.safeParse({ fullName: '', email: 'john@test.com' });
      expect(emptyName.success).toBe(false);
      if (!emptyName.success) {
        expect(emptyName.error.issues[0].message).toBe('Full name is required');
      }

      // Invalid email
      const badEmail = profileFormSchema.safeParse({ fullName: 'John', email: 'not-email' });
      expect(badEmail.success).toBe(false);
      if (!badEmail.success) {
        expect(badEmail.error.issues[0].message).toBe('Invalid email format');
      }
    });
  });

  describe('groupFormSchema', () => {
    it('should validate with custom error messages', () => {
      expect(groupFormSchema.safeParse({ name: 'My Group' }).success).toBe(true);
      expect(groupFormSchema.safeParse({ name: 'My Group', description: 'Desc' }).success).toBe(
        true
      );

      const emptyName = groupFormSchema.safeParse({ name: '' });
      expect(emptyName.success).toBe(false);
      if (!emptyName.success) {
        expect(emptyName.error.issues[0].message).toBe('Group name is required');
      }
    });
  });

  describe('loginFormSchema', () => {
    it('should validate with custom error messages', () => {
      expect(loginFormSchema.safeParse({ email: 'a@b.com', password: 'pass123' }).success).toBe(
        true
      );

      const emptyEmail = loginFormSchema.safeParse({ email: '', password: 'pass123' });
      expect(emptyEmail.success).toBe(false);
      if (!emptyEmail.success) {
        expect(emptyEmail.error.issues[0].message).toBe('Email is required');
      }

      const emptyPass = loginFormSchema.safeParse({ email: 'a@b.com', password: '' });
      expect(emptyPass.success).toBe(false);
      if (!emptyPass.success) {
        expect(emptyPass.error.issues[0].message).toBe('Password is required');
      }
    });
  });

  describe('registerFormSchema', () => {
    it('should validate with custom error messages', () => {
      expect(
        registerFormSchema.safeParse({ fullName: 'John', email: 'a@b.com', password: 'pass123' })
          .success
      ).toBe(true);

      // Password too short - this is a business rule worth testing
      const shortPass = registerFormSchema.safeParse({
        fullName: 'John',
        email: 'a@b.com',
        password: '12345',
      });
      expect(shortPass.success).toBe(false);
      if (!shortPass.success) {
        expect(shortPass.error.issues[0].message).toBe('Password must be at least 6 characters');
      }
    });
  });

  describe('newEventFormSchema', () => {
    it('should validate required fields with custom error messages', () => {
      const validData = {
        name: 'Event',
        is_private: false,
        group_id: '__no_group__',
        datetimeTbd: true,
        endDatetimeTbd: true,
        locationTbd: true,
      };
      expect(newEventFormSchema.safeParse(validData).success).toBe(true);

      const emptyName = newEventFormSchema.safeParse({ ...validData, name: '' });
      expect(emptyName.success).toBe(false);
      if (!emptyName.success) {
        expect(emptyName.error.issues[0].message).toBe('Event name is required');
      }
    });
  });

  describe('eventSchema - business rules', () => {
    const baseEvent = {
      organizer_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Event',
    };

    it('should accept various datetime formats', () => {
      expect(
        eventSchema.safeParse({ ...baseEvent, datetime: '2024-12-31T18:00:00Z' }).success
      ).toBe(true);
      expect(eventSchema.safeParse({ ...baseEvent, datetime: '2024-12-31T18:00' }).success).toBe(
        true
      );
      expect(eventSchema.safeParse({ ...baseEvent, datetime: null }).success).toBe(true);
    });

    it('should reject invalid datetime format', () => {
      const result = eventSchema.safeParse({ ...baseEvent, datetime: 'not-a-date' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid date format');
      }
    });

    it('should enforce participant count business rules', () => {
      // Valid range
      expect(eventSchema.safeParse({ ...baseEvent, max_participants: 50 }).success).toBe(true);
      expect(eventSchema.safeParse({ ...baseEvent, max_participants: null }).success).toBe(true);

      // Below minimum
      const tooFew = eventSchema.safeParse({ ...baseEvent, max_participants: 0 });
      expect(tooFew.success).toBe(false);
      if (!tooFew.success) {
        expect(tooFew.error.issues[0].message).toContain('at least 2');
      }

      // Above maximum
      const tooMany = eventSchema.safeParse({ ...baseEvent, max_participants: 101 });
      expect(tooMany.success).toBe(false);
      if (!tooMany.success) {
        expect(tooMany.error.issues[0].message).toContain('100 participants');
      }

      // Non-integer
      const nonInt = eventSchema.safeParse({ ...baseEvent, max_participants: 50.5 });
      expect(nonInt.success).toBe(false);
      if (!nonInt.success) {
        expect(nonInt.error.issues[0].message).toContain('whole number');
      }
    });
  });

  describe('validateCustomFields helper', () => {
    it('should return empty array for invalid input', () => {
      expect(validateCustomFields(null)).toEqual([]);
      expect(validateCustomFields(undefined)).toEqual([]);
      expect(validateCustomFields('string')).toEqual([]);
    });

    it('should filter out invalid fields and keep valid ones', () => {
      const fields = [
        { label: 'Valid Field', type: 'text', required: false },
        { label: '', type: 'text', required: false }, // Invalid: empty label
        { label: 'Another Valid', type: 'email', required: true },
        { label: 'Test', type: 'invalid-type', required: false }, // Invalid: bad type
      ];

      const result = validateCustomFields(fields);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Valid Field');
      expect(result[1].label).toBe('Another Valid');
    });

    it('should validate all supported field types', () => {
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
  });

  describe('validateResponses helper', () => {
    it('should return empty object for invalid input', () => {
      expect(validateResponses(null, [])).toEqual({});
      expect(validateResponses(undefined, [])).toEqual({});
      expect(validateResponses({ field: 'value' }, [])).toEqual({});
    });

    it('should validate responses against custom fields', () => {
      const customFields: CustomField[] = [
        { id: 'field1', label: 'Name', type: 'text', required: true },
        { id: 'field2', label: 'Age', type: 'number', required: false },
      ];

      const responses = {
        field1: 'John Doe',
        field2: 25,
        unknownField: 'ignored',
      };

      const result = validateResponses(responses, customFields);
      expect(result).toEqual({
        field1: 'John Doe',
        field2: 25,
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
      });
    });

    it('should handle arrays with validation', () => {
      const customFields: CustomField[] = [
        { id: 'field1', label: 'Options', type: 'select', required: false },
      ];

      // Valid array
      expect(validateResponses({ field1: ['tag1', 'tag2'] }, customFields)).toEqual({
        field1: ['tag1', 'tag2'],
      });

      // Array with invalid item (too long)
      expect(validateResponses({ field1: ['valid', 'a'.repeat(101)] }, customFields)).toEqual({});
    });
  });
});
