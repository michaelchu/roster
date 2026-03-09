import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { ForgotPasswordPage } from '../auth/ForgotPasswordPage';
import { useAuth } from '@/hooks/useAuth';

// Mock useAuth
const mockResetPasswordForEmail = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    resetPasswordForEmail: mockResetPasswordForEmail,
  })),
}));

// Mock sonner toast (used by showFormErrors)
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const renderPage = (component: ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the forgot password form', () => {
    renderPage(<ForgotPasswordPage />);

    expect(
      screen.getByText("Enter your email and we'll send you a link to reset your password.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument();
    expect(screen.getByText('Back to Sign In')).toBeInTheDocument();
  });

  it('validates email is required', async () => {
    const user = userEvent.setup();
    renderPage(<ForgotPasswordPage />);

    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    // Form should not submit — resetPasswordForEmail should not be called
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sends reset email and shows confirmation on success', async () => {
    mockResetPasswordForEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
    });

    // Should show confirmation message
    expect(screen.getByText('Check your email for a password reset link.')).toBeInTheDocument();
    expect(screen.getByText("If you don't see it, check your spam folder.")).toBeInTheDocument();
    // Back to sign in link should still be present
    expect(screen.getByText('Back to Sign In')).toBeInTheDocument();
    // Form should no longer be visible
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('shows button loading state while submitting', async () => {
    // Make the reset hang so we can observe the loading state
    let resolveReset: () => void;
    mockResetPasswordForEmail.mockImplementation(
      () => new Promise<void>((resolve) => (resolveReset = resolve))
    );
    const user = userEvent.setup();
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
    });

    // Resolve to clean up
    resolveReset!();
    await waitFor(() => {
      expect(screen.getByText('Check your email for a password reset link.')).toBeInTheDocument();
    });
  });

  it('displays error when reset fails', async () => {
    mockResetPasswordForEmail.mockRejectedValue(new Error('Rate limit exceeded'));
    const user = userEvent.setup();
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });

    // Should stay on the form (not show confirmation)
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('displays fallback error message when error has no message', async () => {
    mockResetPasswordForEmail.mockRejectedValue(new Error());
    const user = userEvent.setup();
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send reset email')).toBeInTheDocument();
    });
  });

  it('has a link back to login page', () => {
    renderPage(<ForgotPasswordPage />);

    const link = screen.getByText('Back to Sign In');
    expect(link).toHaveAttribute('href', '/auth/login');
  });
});
