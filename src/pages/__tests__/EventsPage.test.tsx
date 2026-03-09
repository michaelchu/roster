import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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
  eventService: {
    getEventsByOrganizer: vi.fn(),
    getEventsByParticipant: vi.fn(),
  },
  participantService: {
    getPaymentSummariesBatch: vi.fn(),
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
import { EventsPage } from '../EventsPage';
import { eventService, participantService } from '@/services';

const mockEventService = vi.mocked(eventService);
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

const futureEvent = {
  id: 'future-event',
  name: 'Future Event',
  datetime: '2027-06-01T10:00:00Z',
  end_datetime: null,
  organizer_id: 'organizer-123',
  is_paid: false,
  max_participants: null,
  is_private: false,
  custom_fields: [],
  group_id: null,
  parent_event_id: null,
  cost_breakdown: null,
  created_at: '2026-01-01T00:00:00Z',
  participant_count: 3,
};

const pastPaidUnsettled = {
  id: 'past-unsettled',
  name: 'Past Unsettled Event',
  datetime: '2024-01-01T10:00:00Z',
  end_datetime: '2024-01-01T12:00:00Z',
  organizer_id: 'organizer-123',
  is_paid: true,
  max_participants: null,
  is_private: false,
  custom_fields: [],
  group_id: null,
  parent_event_id: null,
  cost_breakdown: null,
  created_at: '2024-01-01T00:00:00Z',
  participant_count: 4,
};

const pastPaidSettled = {
  id: 'past-settled',
  name: 'Past Settled Event',
  datetime: '2024-02-01T10:00:00Z',
  end_datetime: '2024-02-01T12:00:00Z',
  organizer_id: 'organizer-123',
  is_paid: true,
  max_participants: null,
  is_private: false,
  custom_fields: [],
  group_id: null,
  parent_event_id: null,
  cost_breakdown: null,
  created_at: '2024-02-01T00:00:00Z',
  participant_count: 2,
};

const pastFreeEvent = {
  id: 'past-free',
  name: 'Past Free Event',
  datetime: '2024-03-01T10:00:00Z',
  end_datetime: '2024-03-01T12:00:00Z',
  organizer_id: 'organizer-123',
  is_paid: false,
  max_participants: null,
  is_private: false,
  custom_fields: [],
  group_id: null,
  parent_event_id: null,
  cost_breakdown: null,
  created_at: '2024-03-01T00:00:00Z',
  participant_count: 5,
};

describe('EventsPage - Unsettled payment tab placement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthReturn);
    mockEventService.getEventsByParticipant.mockResolvedValue([]);
  });

  it('shows past paid event with unpaid participants in Organizing tab', async () => {
    const allEvents = [futureEvent, pastPaidUnsettled, pastPaidSettled, pastFreeEvent];
    mockEventService.getEventsByOrganizer.mockResolvedValue(allEvents as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockParticipantService.getPaymentSummariesBatch.mockResolvedValue(
      new Map([
        ['past-unsettled', { total: 4, paid: 1, pending: 3, waived: 0 }],
        ['past-settled', { total: 2, paid: 2, pending: 0, waived: 0 }],
      ])
    );

    render(<EventsPage />);

    // Click Organizing tab
    const organizingTab = await screen.findByRole('tab', { name: /organizing/i });
    await userEvent.click(organizingTab);

    // Unsettled past event should be in Organizing
    await waitFor(() => {
      expect(screen.getByText('Past Unsettled Event')).toBeInTheDocument();
    });
    // Future event should also be in Organizing
    expect(screen.getByText('Future Event')).toBeInTheDocument();
  });

  it('shows past paid event with all paid participants in Archive tab', async () => {
    const allEvents = [futureEvent, pastPaidUnsettled, pastPaidSettled, pastFreeEvent];
    mockEventService.getEventsByOrganizer.mockResolvedValue(allEvents as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockParticipantService.getPaymentSummariesBatch.mockResolvedValue(
      new Map([
        ['past-unsettled', { total: 4, paid: 1, pending: 3, waived: 0 }],
        ['past-settled', { total: 2, paid: 2, pending: 0, waived: 0 }],
      ])
    );

    render(<EventsPage />);

    // Click Archive tab
    const archiveTab = await screen.findByRole('tab', { name: /archive/i });
    await userEvent.click(archiveTab);

    // Settled event should be in Archive
    await waitFor(() => {
      expect(screen.getByText('Past Settled Event')).toBeInTheDocument();
    });
    // Free past event should also be in Archive
    expect(screen.getByText('Past Free Event')).toBeInTheDocument();
    // Unsettled event should NOT be in Archive
    expect(screen.queryByText('Past Unsettled Event')).not.toBeInTheDocument();
  });

  it('does not show unsettled past event in Archive tab', async () => {
    const allEvents = [pastPaidUnsettled];
    mockEventService.getEventsByOrganizer.mockResolvedValue(allEvents as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockParticipantService.getPaymentSummariesBatch.mockResolvedValue(
      new Map([['past-unsettled', { total: 4, paid: 1, pending: 3, waived: 0 }]])
    );

    render(<EventsPage />);

    const archiveTab = await screen.findByRole('tab', { name: /archive/i });
    await userEvent.click(archiveTab);

    await waitFor(() => {
      expect(screen.getByText('No Archived Events')).toBeInTheDocument();
    });
  });
});
