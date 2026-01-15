import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock the auth hook BEFORE importing the component
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

// Mock eventService
vi.mock('@/services', () => ({
  eventService: {
    getEventsByOrganizer: vi.fn(),
    getEventsByParticipant: vi.fn(),
    duplicateEvent: vi.fn(),
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
  useLoadingState: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { User } from '@supabase/supabase-js';
import { EventsPage } from '@/pages/EventsPage';
import { useAuth } from '@/hooks/useAuth';
import { useLoadingState } from '@/hooks/useLoadingState';

const mockUseAuth = vi.mocked(useAuth);
const mockUseLoadingState = vi.mocked(useLoadingState);

const renderWithRouter = (component: ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock return value for useLoadingState
    mockUseLoadingState.mockReturnValue({
      isLoading: false,
      data: [],
      execute: vi.fn(),
      error: null,
      reset: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      setData: vi.fn(),
    });
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

    renderWithRouter(<EventsPage />);

    // Should show loading skeleton (animate-pulse elements)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);

    // Should not show main content or sign-in prompt
    expect(screen.queryByText('Organizing')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign In Required')).not.toBeInTheDocument();
  });

  it('shows sign in prompt when user is not authenticated', () => {
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

    renderWithRouter(<EventsPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
    expect(screen.getByText('Please sign in to view your events')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders events page for authenticated users', () => {
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

    renderWithRouter(<EventsPage />);

    expect(screen.getByText('Organizing')).toBeInTheDocument();
    expect(screen.getByText('Joined')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Event' })).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
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

    renderWithRouter(<EventsPage />);

    expect(screen.getByText('No Events Yet')).toBeInTheDocument();
    expect(
      screen.getByText('Create your first event to start managing registrations')
    ).toBeInTheDocument();
    // ActionButton is still visible (renamed from "New Event" to "Create Event")
    expect(screen.getByRole('button', { name: 'Create Event' })).toBeInTheDocument();
  });
});
