import { describe, it, expect } from 'vitest';

/**
 * Unit tests for date validation logic
 * These test the business rules for event date validation
 */

describe('Event Date Validation', () => {
  const validateEventDates = (
    startDate: string | null,
    endDate: string | null
  ): { valid: boolean; error?: string } => {
    const now = new Date();

    // Validate start date is not in the past
    if (startDate) {
      const start = new Date(startDate);
      if (start < now) {
        return { valid: false, error: 'Start date cannot be in the past' };
      }
    }

    // Validate end date is not in the past
    if (endDate) {
      const end = new Date(endDate);
      if (end < now) {
        return { valid: false, error: 'End date cannot be in the past' };
      }
    }

    // Validate end date is after start date
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        return { valid: false, error: 'End date must be after start date' };
      }
    }

    return { valid: true };
  };

  describe('Past date validation', () => {
    it('rejects events with past start dates', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday
      const result = validateEventDates(pastDate, null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Start date cannot be in the past');
    });

    it('rejects events with past end dates', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const result = validateEventDates(futureDate, pastDate);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('End date cannot be in the past');
    });

    it('accepts events with future start dates', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateEventDates(futureDate, null);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts events with future start and end dates', () => {
      const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateEventDates(startDate, endDate);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts events with null dates (optional fields)', () => {
      const result = validateEventDates(null, null);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Date order validation', () => {
    it('rejects events where end date equals start date', () => {
      const sameDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateEventDates(sameDate, sameDate);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('End date must be after start date');
    });

    it('rejects events where end date is before start date', () => {
      const startDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateEventDates(startDate, endDate);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('End date must be after start date');
    });

    it('accepts events where end date is after start date', () => {
      const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateEventDates(startDate, endDate);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('handles events starting in the next few seconds', () => {
      // Event starting in 5 seconds
      const veryNearFuture = new Date(Date.now() + 5000).toISOString();
      const result = validateEventDates(veryNearFuture, null);

      expect(result.valid).toBe(true);
    });

    it('handles only end date provided (no start date)', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateEventDates(null, futureDate);

      expect(result.valid).toBe(true);
    });

    it('validates dates close to now timestamp boundary', () => {
      // Test a date that's exactly 1 second in the past
      const justPast = new Date(Date.now() - 1000).toISOString();
      const result = validateEventDates(justPast, null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Start date cannot be in the past');
    });
  });
});
