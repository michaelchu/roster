import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { NewEventPage } from '../NewEventPage';
import { useAuth } from '@/hooks/useAuth';

// Mock the auth hook
vi.mock('@/hooks/useAuth');
const mockUseAuth = vi.mocked(useAuth);

// Mock services
vi.mock('@/services', () => ({
  eventService: {
    createEvent: vi.fn(),
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

const renderWithRouter = (component: ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('NewEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create event form for authenticated users', () => {
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

    renderWithRouter(<NewEventPage />);

    expect(screen.getByRole('heading', { name: 'Create Event' })).toBeInTheDocument();
    expect(screen.getByLabelText('Event Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/date & time/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Event' })).toBeInTheDocument();
  });

  it('allows user to enter form data', () => {
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

    renderWithRouter(<NewEventPage />);

    const nameInput = screen.getByLabelText('Event Name *');
    const locationInput = screen.getByLabelText('Location');

    fireEvent.change(nameInput, { target: { value: 'My Test Event' } });
    fireEvent.change(locationInput, { target: { value: 'Test Location' } });

    expect(nameInput).toHaveValue('My Test Event');
    expect(locationInput).toHaveValue('Test Location');
  });

  it('shows form even without authentication', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<NewEventPage />);

    // Form should still be visible (auth check happens on submit)
    expect(screen.getByRole('heading', { name: 'Create Event' })).toBeInTheDocument();
    expect(screen.getByLabelText('Event Name *')).toBeInTheDocument();
  });

  it('shows form even when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<NewEventPage />);

    // Form should still be visible during loading
    expect(screen.getByRole('heading', { name: 'Create Event' })).toBeInTheDocument();
    expect(screen.getByLabelText('Event Name *')).toBeInTheDocument();
  });
});
