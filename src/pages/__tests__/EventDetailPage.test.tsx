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
    useParams: () => ({ eventId: 'test-event-id' }),
    useLocation: () => ({ pathname: '/events/test-event-id', search: '', hash: '', state: null }),
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
const mockUseFeatureFlag = vi.fn((flag: string) => {
  if (flag === 'guest_registration') return true;
  return false;
});
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: (...args: unknown[]) => mockUseFeatureFlag(...(args as [string])),
  FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock services
vi.mock('@/services', () => ({
  eventService: {
    getEventById: vi.fn(),
  },
  participantService: {
    getParticipantsByEventId: vi.fn(),
    getPaymentSummary: vi.fn(),
  },
  labelService: {
    getLabelsByEventId: vi.fn(),
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
  throwIfSupabaseError: vi.fn((result: { error: unknown; data: unknown }) => {
    if (result.error) throw new Error(String(result.error));
    return result.data;
  }),
  requireData: vi.fn((data: unknown, operation: string) => {
    if (data === null || data === undefined) throw new Error(`Failed to ${operation}`);
    return data;
  }),
  fireAndForget: vi.fn(),
}));

import { render } from '@/test/utils/test-utils';
import { EventDetailPage } from '../EventDetailPage';
import { eventService, participantService, labelService } from '@/services';

const mockEventService = vi.mocked(eventService);
const mockParticipantService = vi.mocked(participantService);
const mockLabelService = vi.mocked(labelService);

const mockEvent = {
  id: 'test-event-id',
  name: 'Test Event',
  description: 'A test event',
  datetime: '2026-12-01T10:00:00Z',
  end_datetime: null,
  location: 'Test Location',
  max_participants: 5,
  organizer_id: 'organizer-123',
  is_paid: false,
  is_private: false,
  custom_fields: [],
  group_id: null,
  parent_event_id: null,
  cost_breakdown: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('EventDetailPage - Claim button visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventService.getEventById.mockResolvedValue(mockEvent);
    mockParticipantService.getParticipantsByEventId.mockResolvedValue([]);
    mockLabelService.getLabelsByEventId.mockResolvedValue([]);
    mockUseFeatureFlag.mockImplementation((flag: string) => {
      if (flag === 'guest_registration') return true;
      return false;
    });
  });

  it('shows Claim button when user is the event organizer', async () => {
    mockUseAuth.mockReturnValue({
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
    });

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: /claim/i }).length).toBeGreaterThan(0);
  });

  it('hides Claim button when user is not the event organizer', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-456' } as User,
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
    });

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
  });

  it('hides Claim button when user is unauthenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
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
    });

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
  });
});
