import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { ResetPasswordPage } from '../auth/ResetPasswordPage';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth
const mockUpdatePassword = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    updatePassword: mockUpdatePassword,
  })),
}));

// Mock sonner toast (used by showFormErrors)
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const renderPage = (component: ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the reset password form', () => {
    renderPage(<ResetPasswordPage />);

    expect(screen.getByText('Enter your new password.')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
  });

  it('validates password minimum length', async () => {
    const user = userEvent.setup();
    renderPage(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('New Password'), 'abc');
    await user.type(screen.getByLabelText('Confirm Password'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('validates passwords must match', async () => {
    const user = userEvent.setup();
    renderPage(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('New Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'different456');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('validates confirm password is required', async () => {
    const user = userEvent.setup();
    renderPage(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('New Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('updates password and navigates to login on success', async () => {
    mockUpdatePassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('New Password'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('newpassword123');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows button loading state while submitting', async () => {
    let resolveUpdate: () => void;
    mockUpdatePassword.mockImplementation(
      () => new Promise<void>((resolve) => (resolveUpdate = resolve))
    );
    const user = userEvent.setup();
    renderPage(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('New Password'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resetting...' })).toBeDisabled();
    });

    // Resolve to clean up
    resolveUpdate!();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('displays error when password update fails', async () => {
    mockUpdatePassword.mockRejectedValue(new Error('Session expired'));
    const user = userEvent.setup();
    renderPage(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('New Password'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(screen.getByText('Session expired')).toBeInTheDocument();
    });

    // Should not navigate
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('displays fallback error message when error has no message', async () => {
    mockUpdatePassword.mockRejectedValue(new Error());
    const user = userEvent.setup();
    renderPage(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('New Password'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to reset password')).toBeInTheDocument();
    });
  });
});
