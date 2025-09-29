import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock the auth hook
vi.mock('@/hooks/useAuth');

// Mock useFontSize hook
vi.mock('@/hooks/useFontSize', () => ({
  useFontSize: () => ({
    fontSize: 'md',
    setFontSize: vi.fn(),
    fontSizeLabels: { sm: 'Small', md: 'Medium', lg: 'Large' },
  }),
}));

// Mock theme provider
vi.mock('@/components/theme-provider', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}));

// Mock MobileOnly component
vi.mock('@/components/MobileOnly', () => ({
  MobileOnly: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { User } from '@supabase/supabase-js';
import { SettingsPage } from '@/pages/SettingsPage';
import { useAuth } from '@/hooks/useAuth';

const mockUseAuth = vi.mocked(useAuth);

const renderWithRouter = (component: ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings page header', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<SettingsPage />);

    // Header should always be visible
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders settings for authenticated user', () => {
    const mockUser: User = {
      id: '123',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: { full_name: 'John Doe' },
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

    renderWithRouter(<SettingsPage />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('shows user profile information', () => {
    const mockUser: User = {
      id: '123',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: { full_name: 'John Doe' },
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

    renderWithRouter(<SettingsPage />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('redirects to sign in when no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<SettingsPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });
});
