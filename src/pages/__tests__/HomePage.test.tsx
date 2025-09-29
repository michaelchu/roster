import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { HomePage } from '../HomePage';
import { useAuth } from '@/hooks/useAuth';

// Mock the auth hook
vi.mock('@/hooks/useAuth');
const mockUseAuth = vi.mocked(useAuth);

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome message for unauthenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithRouter(<HomePage />);

    expect(screen.getByText('Welcome to Roster')).toBeInTheDocument();
    expect(screen.getByText('Sign in to create and manage your events')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders quick actions for authenticated users', () => {
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

    renderWithRouter(<HomePage />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Group/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Event/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Payments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bookmarked/i })).toBeInTheDocument();
  });

  it('renders upcoming events section for authenticated users', () => {
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

    renderWithRouter(<HomePage />);

    expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
  });
});
