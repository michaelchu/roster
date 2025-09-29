import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EditGroupPage } from '../EditGroupPage';
import { mockGroup } from '@/test/fixtures/groups';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ groupId: 'group-123' }),
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
    getGroupById: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
  },
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('EditGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state initially', () => {
    render(<EditGroupPage />);

    expect(screen.getByText('Edit Group')).toBeInTheDocument();
    const loadingElements = screen.getAllByText('Loading...');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('loads and displays group data', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);

    render(<EditGroupPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A test group for events')).toBeInTheDocument();
    });
  });

  it('shows validation errors for empty required fields', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);

    render(<EditGroupPage />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Group');
      fireEvent.change(nameInput, { target: { value: '' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Group name is required')).toBeInTheDocument();
    });
  });

  it('shows validation error for name too long', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);

    render(<EditGroupPage />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Group');
      fireEvent.change(nameInput, { target: { value: 'A'.repeat(201) } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Group name must be 200 characters or less')).toBeInTheDocument();
    });
  });

  it('updates group successfully', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.updateGroup).mockResolvedValue(mockGroup);

    render(<EditGroupPage />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Group');
      fireEvent.change(nameInput, { target: { value: 'Updated Group Name' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(groupService.updateGroup).toHaveBeenCalledWith('group-123', {
        name: 'Updated Group Name',
        description: 'A test group for events',
        is_private: false,
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/group-123');
  });

  it('shows loading state during save', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.updateGroup).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<EditGroupPage />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Group');
      fireEvent.change(nameInput, { target: { value: 'Updated Group Name' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });

  it('opens delete dialog when delete button is clicked', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);

    render(<EditGroupPage />);

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: /delete group/i });
      fireEvent.click(deleteButton);
    });

    expect(screen.getByText('Delete Group')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  });

  it('deletes group when confirmed', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.deleteGroup).mockResolvedValue();

    render(<EditGroupPage />);

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: /delete group/i });
      fireEvent.click(deleteButton);
    });

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(groupService.deleteGroup).toHaveBeenCalledWith('group-123');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });

  it('cancels delete dialog', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);

    render(<EditGroupPage />);

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: /delete group/i });
      fireEvent.click(deleteButton);
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Delete Group')).not.toBeInTheDocument();
  });

  it('redirects when group not found', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockRejectedValue(new Error('Group not found'));

    render(<EditGroupPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<EditGroupPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });

  it('navigates back to group detail when back button is clicked', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);

    render(<EditGroupPage />);

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/group-123');
  });
});
