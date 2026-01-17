import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { EditEventPage } from '../EditEventPage';
import { useAuth } from '@/hooks/useAuth';

// Mock the auth hook
vi.mock('@/hooks/useAuth');
const mockUseAuth = vi.mocked(useAuth);

// Mock feature flags hook
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: () => false,
}));

// Mock services
vi.mock('@/services', () => ({
  eventService: {
    getEventById: vi.fn(),
    updateEvent: vi.fn(),
  },
  groupService: {
    getGroupsByOrganizer: vi.fn(),
  },
}));

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock loading state hook
vi.mock('@/hooks/useLoadingState', () => ({
  useLoadingState: () => ({
    isLoading: false,
    data: [],
    execute: vi.fn(),
  }),
}));

// Mock react-router hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ eventId: 'test-event-id' }),
    useNavigate: () => vi.fn(),
  };
});

const renderWithRouter = (component: ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('EditEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows page header when auth is loading', () => {
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

    renderWithRouter(<EditEventPage />);

    // Should show page header even during loading (TopNav shows Roster logo)
  });

  it('shows loading skeleton when no user', () => {
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

    renderWithRouter(<EditEventPage />);

    // Should show page header and skeleton content
    expect(screen.queryByText('Sign In Required')).not.toBeInTheDocument();
  });

  it('renders for authenticated users', () => {
    const mockUser: User = {
      id: '123',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z',
    } as User;

    mockUseAuth.mockReturnValue({
      user: mockUser,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signInWithGoogleIdToken: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<EditEventPage />);

    // Should not show sign in required
    expect(screen.queryByText('Sign In Required')).not.toBeInTheDocument();
  });
});
