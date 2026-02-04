import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock the auth hook BEFORE importing the component
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

// Mock services
vi.mock('@/services', () => ({
  groupService: {
    createGroup: vi.fn(),
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

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { User } from '@supabase/supabase-js';
import { NewGroupPage } from '@/pages/NewGroupPage';
import { useAuth } from '@/hooks/useAuth';
import { FeatureFlagsProvider } from '@/hooks/useFeatureFlags';

const mockUseAuth = vi.mocked(useAuth);

const renderWithRouter = (component: ReactElement) => {
  return render(
    <FeatureFlagsProvider>
      <BrowserRouter>{component}</BrowserRouter>
    </FeatureFlagsProvider>
  );
};

describe('NewGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create group form for authenticated users', () => {
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

    renderWithRouter(<NewGroupPage />);

    expect(screen.getByLabelText('Group Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
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
      signInWithGoogleIdToken: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<NewGroupPage />);

    const nameInput = screen.getByLabelText('Group Name *');
    const descriptionInput = screen.getByLabelText('Description');

    fireEvent.change(nameInput, { target: { value: 'My Test Group' } });
    fireEvent.change(descriptionInput, { target: { value: 'A great group for testing' } });

    expect(nameInput).toHaveValue('My Test Group');
    expect(descriptionInput).toHaveValue('A great group for testing');
  });

  it('redirects to sign in when no user', () => {
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

    renderWithRouter(<NewGroupPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
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

    renderWithRouter(<NewGroupPage />);

    // Should show loading state, not the form
    expect(screen.queryByLabelText('Group Name *')).not.toBeInTheDocument();
  });
});
