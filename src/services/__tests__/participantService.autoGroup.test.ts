/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createQueryChain } from '@/test/mocks/supabase';

// Must provide factory to avoid real module loading (env vars check)
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase';

vi.mock('@/lib/errorHandler', async () => {
  const actual = await vi.importActual('@/lib/errorHandler');
  return {
    ...actual,
    throwIfSupabaseError: vi.fn((result) => {
      if (result.error) throw result.error;
      return result.data;
    }),
    requireData: vi.fn((data, operation) => {
      if (!data) throw new Error(`No data for ${operation}`);
      return data;
    }),
    fireAndForget: vi.fn((promise) => {
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
      }
    }),
  };
});

vi.mock('../notificationService', () => ({
  notificationService: {
    queueNewSignup: vi.fn().mockResolvedValue(undefined),
    queueSignupConfirmed: vi.fn().mockResolvedValue(undefined),
    queueCapacityReached: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../participantActivityService', () => ({
  participantActivityService: {
    logJoined: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../groupService', () => ({
  groupService: {
    addUserToGroup: vi.fn().mockResolvedValue(undefined),
  },
}));

import { participantService } from '../participantService';
import { groupService } from '../groupService';

const mockSupabase = vi.mocked(supabase);
const mockGroupService = vi.mocked(groupService);

const baseParticipant = {
  event_id: 'event-1',
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  notes: null,
  user_id: 'user-1',
  claimed_by_user_id: null,
  responses: {},
  payment_status: 'pending' as const,
  payment_marked_at: null,
  payment_notes: null,
};

const createdParticipant = {
  id: 'p1',
  ...baseParticipant,
  created_at: '2024-01-01T00:00:00Z',
};

const groupEvent = {
  id: 'event-1',
  name: 'Weekly Pickup Game',
  organizer_id: 'org-1',
  max_participants: null,
  group_id: 'group-1',
};

const standaloneEvent = {
  id: 'event-2',
  name: 'One-off Meetup',
  organizer_id: 'org-1',
  max_participants: null,
  group_id: null,
};

describe('createParticipant – auto-add to group integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-add authenticated user to group when registering for a group event', async () => {
    // 1st from() → insert participant
    const insertChain = createQueryChain({ data: createdParticipant, error: null });
    // 2nd from() → getEventInfo (returns group event)
    const eventInfoChain = createQueryChain({ data: groupEvent, error: null });

    mockSupabase.from
      .mockReturnValueOnce(insertChain as any)
      .mockReturnValueOnce(eventInfoChain as any);

    await participantService.createParticipant(baseParticipant);

    expect(mockGroupService.addUserToGroup).toHaveBeenCalledWith('group-1', 'user-1');
  });

  it('should NOT auto-add to group when registering for a standalone event', async () => {
    const insertChain = createQueryChain({
      data: { ...createdParticipant, event_id: 'event-2' },
      error: null,
    });
    const eventInfoChain = createQueryChain({ data: standaloneEvent, error: null });

    mockSupabase.from
      .mockReturnValueOnce(insertChain as any)
      .mockReturnValueOnce(eventInfoChain as any);

    await participantService.createParticipant({ ...baseParticipant, event_id: 'event-2' });

    expect(mockGroupService.addUserToGroup).not.toHaveBeenCalled();
  });

  it('should NOT auto-add guest registration to group (no user_id)', async () => {
    const guestParticipant = {
      ...createdParticipant,
      user_id: null,
      name: 'Guest Player',
    };

    const insertChain = createQueryChain({ data: guestParticipant, error: null });
    const eventInfoChain = createQueryChain({ data: groupEvent, error: null });

    mockSupabase.from
      .mockReturnValueOnce(insertChain as any)
      .mockReturnValueOnce(eventInfoChain as any);

    await participantService.createParticipant({
      ...baseParticipant,
      user_id: null,
      name: 'Guest Player',
    });

    expect(mockGroupService.addUserToGroup).not.toHaveBeenCalled();
  });

  it('should NOT auto-add claimed spot to group (user_id is null for claimed spots)', async () => {
    const claimedParticipant = {
      ...createdParticipant,
      user_id: null,
      claimed_by_user_id: 'user-1',
      name: 'Friend of User',
    };

    const insertChain = createQueryChain({ data: claimedParticipant, error: null });
    const eventInfoChain = createQueryChain({ data: groupEvent, error: null });

    mockSupabase.from
      .mockReturnValueOnce(insertChain as any)
      .mockReturnValueOnce(eventInfoChain as any);

    await participantService.createParticipant(
      {
        ...baseParticipant,
        user_id: null,
        name: 'Friend of User',
      },
      { claimingUserId: 'user-1', claimingUserEmail: 'claimer@example.com' }
    );

    // The claimer's user_id is set as claimed_by_user_id, not user_id
    // So auto-add should NOT fire for claimed spots
    expect(mockGroupService.addUserToGroup).not.toHaveBeenCalled();
  });

  it('should auto-add user to group when added via batch registration for a group event', async () => {
    const insertChain = createQueryChain({
      data: { ...createdParticipant, user_id: 'user-2', name: 'Batch Member' },
      error: null,
    });
    const eventInfoChain = createQueryChain({ data: groupEvent, error: null });

    mockSupabase.from
      .mockReturnValueOnce(insertChain as any)
      .mockReturnValueOnce(eventInfoChain as any);

    await participantService.createParticipantsBatch('event-1', [
      { name: 'Batch Member', user_id: 'user-2' },
    ]);

    expect(mockGroupService.addUserToGroup).toHaveBeenCalledWith('group-1', 'user-2');
  });
});
