import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RegisterPage } from '../RegisterPage';

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

const mockSignUp = vi.fn();
const mockSignInWithGoogle = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
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

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the register form', () => {
    render(<RegisterPage />);

    expect(screen.getByText('Create Roster Account')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('updates form fields when typing', () => {
    render(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('submits form with all fields', async () => {
    mockSignUp.mockResolvedValue(undefined);

    render(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123', 'John Doe');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows loading state during registration', async () => {
    mockSignUp.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating account...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  it('displays error message on registration failure', async () => {
    mockSignUp.mockRejectedValue(new Error('Email already exists'));

    render(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles Google sign up', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);

    render(<RegisterPage />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows loading state during Google sign up', async () => {
    mockSignInWithGoogle.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<RegisterPage />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(screen.getByText('Signing up with Google...')).toBeInTheDocument();
      expect(googleButton).toBeDisabled();
    });
  });

  it('displays error message on Google sign up failure', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('Google sign up failed'));

    render(<RegisterPage />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(screen.getByText('Google sign up failed')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows link to login page', () => {
    render(<RegisterPage />);

    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('clears error when form is resubmitted', async () => {
    mockSignUp
      .mockRejectedValueOnce(new Error('Email already exists'))
      .mockResolvedValueOnce(undefined);

    render(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });

    // Submit again with different email
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('Email already exists')).not.toBeInTheDocument();
    });
  });

  it('handles form submission with empty fields gracefully', async () => {
    render(<RegisterPage />);

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('', '', '');
    });
  });

  it('shows required field validation', () => {
    render(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(nameInput).toBeRequired();
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('navigates to login page when sign in link is clicked', () => {
    render(<RegisterPage />);

    const signInLink = screen.getByText('Sign in');
    expect(signInLink).toHaveAttribute('href', '/auth/login');
  });

  it('disables buttons during loading states', async () => {
    mockSignUp.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });
    const googleButton = screen.getByRole('button', { name: /continue with google/i });

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(googleButton).toBeDisabled();
    });
  });

  it('shows password requirements', () => {
    render(<RegisterPage />);

    expect(screen.getByText(/Must be at least 6 characters/)).toBeInTheDocument();
  });

  it('validates email format', () => {
    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('validates password minimum length', () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('minLength', '6');
  });
});
