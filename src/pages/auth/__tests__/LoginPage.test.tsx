import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

const mockSignIn = vi.fn();
const mockSignInWithGoogle = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signInWithGoogle: mockSignInWithGoogle,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the login form', () => {
    render(<LoginPage />);

    expect(screen.getByText('Sign In to Roster')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('updates form fields when typing', () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('submits form with email and password', async () => {
    mockSignIn.mockResolvedValue(undefined);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows loading state during email sign in', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  it('displays error message on sign in failure', async () => {
    mockSignIn.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles Google sign in', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);

    render(<LoginPage />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows loading state during Google sign in', async () => {
    mockSignInWithGoogle.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<LoginPage />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(screen.getByText('Signing in with Google...')).toBeInTheDocument();
      expect(googleButton).toBeDisabled();
    });
  });

  it('displays error message on Google sign in failure', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('Google sign in failed'));

    render(<LoginPage />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(screen.getByText('Google sign in failed')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows link to register page', () => {
    render(<LoginPage />);

    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('clears error when form is resubmitted', async () => {
    mockSignIn
      .mockRejectedValueOnce(new Error('Invalid credentials'))
      .mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    // Submit again with correct credentials
    fireEvent.change(passwordInput, { target: { value: 'correctpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });
  });

  it('handles form submission with empty fields gracefully', async () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('', '');
    });
  });

  it('shows required field validation', () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('navigates to register page when sign up link is clicked', () => {
    render(<LoginPage />);

    const signUpLink = screen.getByText('Sign up');
    expect(signUpLink).toHaveAttribute('href', '/auth/register');
  });

  it('disables buttons during loading states', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    const googleButton = screen.getByRole('button', { name: /continue with google/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(googleButton).toBeDisabled();
    });
  });
});
