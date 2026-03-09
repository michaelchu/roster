import { describe, it, expect } from 'vitest';
import { canUserClaimSpot } from '@/lib/utils';

describe('canUserClaimSpot', () => {
  const baseArgs = {
    hasUser: true,
    isRegistered: true,
    isFirstEmptySlot: true,
    showGuestRegistration: true,
  };

  it('returns true when registered user views first empty slot with guest registration enabled', () => {
    expect(canUserClaimSpot(baseArgs)).toBe(true);
  });

  it('returns false when user is not logged in', () => {
    expect(canUserClaimSpot({ ...baseArgs, hasUser: false })).toBe(false);
  });

  it('returns false when user is not registered for the event', () => {
    expect(canUserClaimSpot({ ...baseArgs, isRegistered: false })).toBe(false);
  });

  it('returns false for non-first empty slots', () => {
    expect(canUserClaimSpot({ ...baseArgs, isFirstEmptySlot: false })).toBe(false);
  });

  it('returns false when guest registration feature flag is disabled', () => {
    expect(canUserClaimSpot({ ...baseArgs, showGuestRegistration: false })).toBe(false);
  });
});
