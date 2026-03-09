import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ groupId: 'test-group-id' }),
  };
});

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'organizer-123' },
    loading: false,
    isAdmin: false,
    isImpersonating: false,
    impersonate: vi.fn(),
    stopImpersonating: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
const mockUseAuth = vi.mocked(useAuth);

// Mock useFeatureFlags
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(() => false),
  FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock services
vi.mock('@/services', () => ({
  groupService: {
    getGroupById: vi.fn(),
    getGroupParticipants: vi.fn(),
    getGroupEvents: vi.fn(),
    isGroupAdmin: vi.fn(),
  },
  eventService: {
    duplicateEvent: vi.fn(),
  },
  participantService: {
    getPaymentSummariesBatch: vi.fn(),
    getMyPaymentStatusBatch: vi.fn(),
  },
  pushSubscriptionService: {
    isSupported: vi.fn(() => false),
    isConfigured: vi.fn(() => false),
    isSubscribed: vi.fn(() => Promise.resolve(false)),
    getSubscriptions: vi.fn(() => Promise.resolve([])),
  },
  notificationService: {
    getNotifications: vi.fn(() => Promise.resolve([])),
    getUnreadCount: vi.fn(() => Promise.resolve(0)),
    subscribeToNotifications: vi.fn(() => vi.fn()),
  },
  notificationPreferenceService: {
    getPreferences: vi.fn(() => Promise.resolve(null)),
  },
}));

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  logError: vi.fn(),
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { render } from '@/test/utils/test-utils';
import { GroupDetailPage } from '../GroupDetailPage';
import { groupService, participantService } from '@/services';

const mockGroupService = vi.mocked(groupService);
const mockParticipantService = vi.mocked(participantService);

const mockAuthReturn = {
  user: { id: 'organizer-123' } as User,
  session: null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithGoogleIdToken: vi.fn(),
  signOut: vi.fn(),
  isAdmin: false,
  isImpersonating: false,
  impersonate: vi.fn(),
  stopImpersonating: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updatePassword: vi.fn(),
};

const mockGroup = {
  id: 'test-group-id',
  name: 'Test Group',
  description: 'A test group',
  owner_id: 'organizer-123',
  created_at: '2026-01-01T00:00:00Z',
  invite_code: 'abc123',
};

const futureEvent = {
  id: 'future-event',
  name: 'Future Group Event',
  datetime: '2027-06-01T10:00:00Z',
  end_datetime: null,
  organizer_id: 'organizer-123',
  is_paid: false,
  max_participants: null,
  is_private: false,
  custom_fields: [],
  group_id: 'test-group-id',
  parent_event_id: null,
  cost_breakdown: null,
  created_at: '2026-01-01T00:00:00Z',
  participant_count: 3,
};

const pastPaidUnsettled = {
  id: 'past-unsettled',
  name: 'Past Unsettled Group Event',
  datetime: '2024-01-01T10:00:00Z',
  end_datetime: '2024-01-01T12:00:00Z',
  organizer_id: 'organizer-123',
  is_paid: true,
  max_participants: null,
  is_private: false,
  custom_fields: [],
  group_id: 'test-group-id',
  parent_event_id: null,
  cost_breakdown: null,
  created_at: '2024-01-01T00:00:00Z',
  participant_count: 4,
};

const pastPaidSettled = {
  id: 'past-settled',
  name: 'Past Settled Group Event',
  datetime: '2024-02-01T10:00:00Z',
  end_datetime: '2024-02-01T12:00:00Z',
  organizer_id: 'organizer-123',
  is_paid: true,
  max_participants: null,
  is_private: false,
  custom_fields: [],
  group_id: 'test-group-id',
  parent_event_id: null,
  cost_breakdown: null,
  created_at: '2024-02-01T00:00:00Z',
  participant_count: 2,
};

describe('GroupDetailPage - Unsettled payment filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthReturn);
    mockGroupService.getGroupById.mockResolvedValue(mockGroup as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockGroupService.getGroupParticipants.mockResolvedValue([]);
    mockGroupService.isGroupAdmin.mockResolvedValue(true);
  });

  it('shows past paid event with unpaid participants in Active filter', async () => {
    const allEvents = [futureEvent, pastPaidUnsettled, pastPaidSettled];
    mockGroupService.getGroupEvents.mockResolvedValue(allEvents as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockParticipantService.getPaymentSummariesBatch.mockResolvedValue(
      new Map([
        ['past-unsettled', { total: 4, paid: 1, pending: 3, waived: 0 }],
        ['past-settled', { total: 2, paid: 2, pending: 0, waived: 0 }],
      ])
    );

    render(<GroupDetailPage />);

    // Wait for group to load first
    await waitFor(() => {
      expect(screen.getByText('Test Group')).toBeInTheDocument();
    });

    // Wait for events to load — getGroupEvents is called, data should render
    await waitFor(() => {
      expect(mockGroupService.getGroupEvents).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Past Unsettled Group Event')).toBeInTheDocument();
    });
    // Future event should also be in Active
    expect(screen.getByText('Future Group Event')).toBeInTheDocument();
    // Settled past event should NOT be in Active
    expect(screen.queryByText('Past Settled Group Event')).not.toBeInTheDocument();
  });

  it('excludes settled past event from Active filter', async () => {
    const allEvents = [futureEvent, pastPaidUnsettled, pastPaidSettled];
    mockGroupService.getGroupEvents.mockResolvedValue(allEvents as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockParticipantService.getPaymentSummariesBatch.mockResolvedValue(
      new Map([
        ['past-unsettled', { total: 4, paid: 1, pending: 3, waived: 0 }],
        ['past-settled', { total: 2, paid: 2, pending: 0, waived: 0 }],
      ])
    );

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Future Group Event')).toBeInTheDocument();
    });

    // Settled past event should NOT appear in Active view
    expect(screen.queryByText('Past Settled Group Event')).not.toBeInTheDocument();
    // Unsettled past event should appear in Active view
    expect(screen.getByText('Past Unsettled Group Event')).toBeInTheDocument();
  });

  it('shows only the unsettled event in Active when all others are settled', async () => {
    // Only unsettled event — should show in Active, not be empty
    mockGroupService.getGroupEvents.mockResolvedValue([pastPaidUnsettled] as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockParticipantService.getPaymentSummariesBatch.mockResolvedValue(
      new Map([['past-unsettled', { total: 4, paid: 1, pending: 3, waived: 0 }]])
    );

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Past Unsettled Group Event')).toBeInTheDocument();
    });
  });
});

describe('GroupDetailPage - Non-admin participant payment filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthReturn);
    mockGroupService.getGroupById.mockResolvedValue(mockGroup as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockGroupService.getGroupParticipants.mockResolvedValue([]);
    mockGroupService.isGroupAdmin.mockResolvedValue(false); // Non-admin
  });

  it('shows past paid event in Active when participant has pending payment', async () => {
    mockGroupService.getGroupEvents.mockResolvedValue([futureEvent, pastPaidUnsettled] as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockParticipantService.getMyPaymentStatusBatch.mockResolvedValue(
      new Map([['past-unsettled', 'pending']])
    );

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Group')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Past Unsettled Group Event')).toBeInTheDocument();
    });
    expect(screen.getByText('Future Group Event')).toBeInTheDocument();
  });

  it('hides past paid event from Active when participant has paid', async () => {
    mockGroupService.getGroupEvents.mockResolvedValue([futureEvent, pastPaidSettled] as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockParticipantService.getMyPaymentStatusBatch.mockResolvedValue(
      new Map([['past-settled', 'paid']])
    );

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Future Group Event')).toBeInTheDocument();
    });
    // Settled event should NOT appear in Active for non-admin
    expect(screen.queryByText('Past Settled Group Event')).not.toBeInTheDocument();
  });
});
