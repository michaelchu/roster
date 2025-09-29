import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock the auth hook
vi.mock('@/hooks/useAuth');

// Mock services
vi.mock('@/services', () => ({
  eventService: {
    getEventById: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
  participantService: {
    getParticipantsByEvent: vi.fn(),
    createParticipant: vi.fn(),
    updateParticipant: vi.fn(),
    deleteParticipant: vi.fn(),
    exportParticipants: vi.fn(),
  },
  labelService: {
    getLabelsByOrganizer: vi.fn(),
    createLabel: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock react-router hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-event-id' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/events/test-event-id', state: null }),
  };
});

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { User } from '@supabase/supabase-js';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { useAuth } from '@/hooks/useAuth';

const mockUseAuth = vi.mocked(useAuth);

const renderWithRouter = (component: ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('EventDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton initially', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<EventDetailPage />);

    // Should show loading skeleton
    expect(screen.queryByText('Event Details')).not.toBeInTheDocument();
  });

  it('renders public roster view when unauthenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<EventDetailPage />);

    // Should render roster for public events; no sign-in gate
    expect(screen.getByText('Roster')).toBeInTheDocument();
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
      signOut: vi.fn(),
    });

    renderWithRouter(<EventDetailPage />);

    // Should not show sign in required
    expect(screen.queryByText('Sign In Required')).not.toBeInTheDocument();
  });
});
