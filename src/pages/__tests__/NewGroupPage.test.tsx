import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NewGroupPage } from '../NewGroupPage';

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
}

const mockUseAuth = vi.fn(() => ({
  user: { id: 'user-123', email: 'test@example.com' } as MockUser | null,
  loading: false,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/services', () => ({
  groupService: {
    createGroup: vi.fn(),
  },
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('NewGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the new group form', () => {
    render(<NewGroupPage />);

    expect(screen.getByText('New Group')).toBeInTheDocument();
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty required fields', async () => {
    render(<NewGroupPage />);

    const submitButton = screen.getByRole('button', { name: /create group/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Group name is required')).toBeInTheDocument();
    });
  });

  it('shows validation error for name too long', async () => {
    render(<NewGroupPage />);

    const nameInput = screen.getByLabelText(/group name/i);
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(201) } });

    const submitButton = screen.getByRole('button', { name: /create group/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Group name must be 200 characters or less')).toBeInTheDocument();
    });
  });

  it('shows validation error for description too long', async () => {
    render(<NewGroupPage />);

    const nameInput = screen.getByLabelText(/group name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    fireEvent.change(nameInput, { target: { value: 'Valid Group Name' } });
    fireEvent.change(descriptionInput, { target: { value: 'A'.repeat(2001) } });

    const submitButton = screen.getByRole('button', { name: /create group/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Description must be 2000 characters or less')).toBeInTheDocument();
    });
  });

  it('creates group successfully with valid data', async () => {
    const { groupService } = await import('@/services');
    const mockCreatedGroup = { id: 'new-group-123', name: 'Test Group' };
    vi.mocked(groupService.createGroup).mockResolvedValue(mockCreatedGroup);

    render(<NewGroupPage />);

    const nameInput = screen.getByLabelText(/group name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    fireEvent.change(nameInput, { target: { value: 'Test Group' } });
    fireEvent.change(descriptionInput, { target: { value: 'A test group description' } });

    const submitButton = screen.getByRole('button', { name: /create group/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(groupService.createGroup).toHaveBeenCalledWith({
        name: 'Test Group',
        description: 'A test group description',
        is_private: false,
        organizer_id: 'user-123',
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/new-group-123');
  });

  it('toggles private group setting', () => {
    render(<NewGroupPage />);

    const privateSwitch = screen.getByRole('switch', { name: /private group/i });
    expect(privateSwitch).not.toBeChecked();

    fireEvent.click(privateSwitch);
    expect(privateSwitch).toBeChecked();
  });

  it('shows loading state during form submission', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.createGroup).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<NewGroupPage />);

    const nameInput = screen.getByLabelText(/group name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Group' } });

    const submitButton = screen.getByRole('button', { name: /create group/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  it('handles form submission error gracefully', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.createGroup).mockRejectedValue(new Error('Creation failed'));

    render(<NewGroupPage />);

    const nameInput = screen.getByLabelText(/group name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Group' } });

    const submitButton = screen.getByRole('button', { name: /create group/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
    });
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<NewGroupPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });

  it('navigates to groups page when back button is clicked', () => {
    render(<NewGroupPage />);

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });
});
