import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProfilePage } from '../ProfilePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

interface MockUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

const mockUseAuth = vi.fn(() => ({
  user: {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: { full_name: 'John Doe' },
  } as MockUser | null,
  loading: false,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUpdateUser = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: mockUpdateUser,
    },
  },
}));

vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
  },
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the profile form with user data', () => {
    render(<ProfilePage />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('updates form data when input changes', () => {
    render(<ProfilePage />);

    const nameInput = screen.getByDisplayValue('John Doe');
    const emailInput = screen.getByDisplayValue('test@example.com');

    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } });

    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
  });

  it('submits profile update successfully', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    render(<ProfilePage />);

    const nameInput = screen.getByDisplayValue('John Doe');
    const emailInput = screen.getByDisplayValue('test@example.com');

    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } });

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        email: 'jane@example.com',
        data: {
          full_name: 'Jane Doe',
        },
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('shows loading state during form submission', async () => {
    mockUpdateUser.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ProfilePage />);

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  it('handles form submission error', async () => {
    const { errorHandler } = await import('@/lib/errorHandler');
    mockUpdateUser.mockResolvedValue({ error: { message: 'Update failed' } });

    render(<ProfilePage />);

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(errorHandler.handle).toHaveBeenCalledWith({ message: 'Update failed' });
    });

    // Should not navigate on error
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('displays loading skeleton when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    render(<ProfilePage />);

    // Check for skeleton loading state
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<ProfilePage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
    expect(screen.getByText('Please sign in to view your profile')).toBeInTheDocument();
  });

  it('navigates back to settings when back button is clicked', () => {
    render(<ProfilePage />);

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('handles missing user metadata gracefully', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        // No user_metadata
      } as MockUser | null,
      loading: false,
    });

    render(<ProfilePage />);

    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue(''); // Empty string for missing name
  });

  it('shows success message on successful update', async () => {
    const { errorHandler } = await import('@/lib/errorHandler');
    mockUpdateUser.mockResolvedValue({ error: null });

    render(<ProfilePage />);

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(errorHandler.success).toHaveBeenCalledWith('Profile updated successfully!');
    });
  });

  it('prevents form submission when user is null', async () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<ProfilePage />);

    // Should show sign in prompt instead of form
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });

  it('displays form fields with proper labels', () => {
    render(<ProfilePage />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows proper page title', () => {
    render(<ProfilePage />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
  });
});
