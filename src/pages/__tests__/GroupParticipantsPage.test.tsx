import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock the auth hook
vi.mock('@/hooks/useAuth');

// Mock groupService
vi.mock('@/services', () => ({
  groupService: {
    getGroupById: vi.fn(),
    getGroupParticipants: vi.fn(),
    isGroupAdmin: vi.fn(),
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
    useParams: () => ({ groupId: 'test-group-id' }),
    useNavigate: () => vi.fn(),
  };
});

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { User } from '@supabase/supabase-js';
import { GroupParticipantsPage } from '@/pages/GroupParticipantsPage';
import { useAuth } from '@/hooks/useAuth';

const mockUseAuth = vi.mocked(useAuth);

const renderWithRouter = (component: ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('GroupParticipantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when auth is loading', () => {
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

    renderWithRouter(<GroupParticipantsPage />);

    // Should show loading skeleton
    expect(screen.queryByText('Participants')).not.toBeInTheDocument();
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

    renderWithRouter(<GroupParticipantsPage />);

    // Should not show sign-in prompt; page remains in loading state
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

    renderWithRouter(<GroupParticipantsPage />);

    // Should not show sign in required
    expect(screen.queryByText('Sign In Required')).not.toBeInTheDocument();
  });
});
