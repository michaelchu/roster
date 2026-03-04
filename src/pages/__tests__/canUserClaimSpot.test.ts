import { describe, it, expect } from 'vitest';
import { canUserClaimSpot } from '@/lib/utils';

describe('canUserClaimSpot', () => {
  const baseArgs = {
    hasUser: true,
    isOrganizer: true,
    isFirstEmptySlot: true,
    showGuestRegistration: true,
  };

  it('returns true when organizer views first empty slot with guest registration enabled', () => {
    expect(canUserClaimSpot(baseArgs)).toBe(true);
  });

  it('returns false when user is not logged in', () => {
    expect(canUserClaimSpot({ ...baseArgs, hasUser: false })).toBe(false);
  });

  it('returns false when user is not the organizer', () => {
    expect(canUserClaimSpot({ ...baseArgs, isOrganizer: false })).toBe(false);
  });

  it('returns false for non-first empty slots', () => {
    expect(canUserClaimSpot({ ...baseArgs, isFirstEmptySlot: false })).toBe(false);
  });

  it('returns false when guest registration feature flag is disabled', () => {
    expect(canUserClaimSpot({ ...baseArgs, showGuestRegistration: false })).toBe(false);
  });
});
