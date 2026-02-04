import { describe, it, beforeEach, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { InviteConfirmationPage } from '../InviteConfirmationPage';
import { useAuth } from '@/hooks/useAuth';
import { FeatureFlagsProvider } from '@/hooks/useFeatureFlags';
import { eventService, groupService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';

// Mock the auth hook
vi.mock('@/hooks/useAuth');
const mockUseAuth = vi.mocked(useAuth);

// Mock services
vi.mock('@/services', () => ({
  eventService: {
    getEventById: vi.fn(),
  },
  groupService: {
    getGroupById: vi.fn(),
    checkUserGroupMembership: vi.fn(),
    addUserToGroup: vi.fn(),
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
  },
  throwIfSupabaseError: vi.fn((result) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }),
  requireData: vi.fn((data, operation) => {
    if (data === null || data === undefined) {
      throw new Error(`Failed to ${operation}`);
    }
    return data;
  }),
}));
const mockErrorHandler = vi.mocked(errorHandler);

// Mock react-router hooks with shared variables for dynamic test values
const mockNavigate = vi.fn();
let mockType = 'event';
let mockId = 'test-event-id';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ type: mockType, id: mockId }),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: `/invite/${mockType}/${mockId}` }),
  };
});

const renderWithRouter = (component: ReactElement) => {
  return render(
    <FeatureFlagsProvider>
      <BrowserRouter>{component}</BrowserRouter>
    </FeatureFlagsProvider>
  );
};

const mockEvent = {
  id: 'test-event-id',
  organizer_id: 'organizer-123',
  name: 'Test Event',
  description: 'A test event description',
  datetime: '2024-12-01T14:00:00Z',
  end_datetime: '2024-12-01T16:00:00Z',
  location: 'Test Location',
  is_private: false,
  custom_fields: [],
  created_at: '2024-01-01T00:00:00Z',
  parent_event_id: null,
  group_id: null,
  max_participants: 50,
  participant_count: 10,
};

const mockGroup = {
  id: 'test-group-id',
  organizer_id: 'organizer-123',
  name: 'Test Group',
  description: 'A test group description',
  is_private: false,
  created_at: '2024-01-01T00:00:00Z',
  event_count: 5,
  participant_count: 20,
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
  },
};

describe('InviteConfirmationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Event Invites', () => {
    beforeEach(() => {
      // Set mock variables for event routes
      mockType = 'event';
      mockId = 'test-event-id';
    });

    it('shows loading skeleton initially', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: true,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      renderWithRouter(<InviteConfirmationPage />);

      // EventDetailSkeleton should be rendered during loading
      expect(screen.queryByText('Event Invitation')).not.toBeInTheDocument();
    });

    it('shows sign in button for unauthenticated users', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

      renderWithRouter(<InviteConfirmationPage />);

      await waitFor(() => {
        expect(screen.getByText('Event Invitation')).toBeInTheDocument();
        expect(screen.getByText('Test Event')).toBeInTheDocument();
        expect(screen.getByText('Sign in to RSVP')).toBeInTheDocument();
        // Should NOT show guest RSVP option
        expect(screen.queryByText('RSVP as Guest')).not.toBeInTheDocument();
      });
    });

    it('navigates to login with returnUrl when sign in clicked', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

      renderWithRouter(<InviteConfirmationPage />);

      await waitFor(() => {
        expect(screen.getByText('Sign in to RSVP')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign in to RSVP');
      fireEvent.click(signInButton);

      // Check navigation to login with returnUrl pointing back to invite page
      expect(mockNavigate).toHaveBeenCalledWith(
        '/auth/login?returnUrl=%2Finvite%2Fevent%2Ftest-event-id'
      );
    });

    it('auto-redirects authenticated user to event signup page', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

      renderWithRouter(<InviteConfirmationPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/signup/test-event-id');
      });
    });

    it('shows toast and redirects home for invalid event ID', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      vi.mocked(eventService.getEventById).mockRejectedValue(new Error('Event not found'));

      renderWithRouter(<InviteConfirmationPage />);

      await waitFor(() => {
        expect(mockErrorHandler.handle).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Group Invites', () => {
    beforeEach(() => {
      // Set mock variables for group routes
      mockType = 'group';
      mockId = 'test-group-id';
    });

    it('shows sign in button for unauthenticated users', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);

      renderWithRouter(<InviteConfirmationPage />);

      await waitFor(() => {
        expect(screen.getByText('Group Invitation')).toBeInTheDocument();
        expect(screen.getByText('Test Group')).toBeInTheDocument();
      });
    });

    it('auto-redirects existing member to group page', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
      vi.mocked(groupService.checkUserGroupMembership).mockResolvedValue(true);

      renderWithRouter(<InviteConfirmationPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/groups/test-group-id');
      });
    });

    it('auto-joins and redirects non-member to group page', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        session: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
      vi.mocked(groupService.checkUserGroupMembership).mockResolvedValue(false);

      renderWithRouter(<InviteConfirmationPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/groups/test-group-id');
      });
    });
  });
});
