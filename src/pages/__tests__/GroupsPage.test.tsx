import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GroupsPage } from '../GroupsPage';
import { mockGroupsList } from '@/test/fixtures/groups';

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
    getGroupsByOrganizer: vi.fn(),
    deleteGroup: vi.fn(),
  },
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('GroupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state initially', () => {
    render(<GroupsPage />);

    expect(screen.getByText('My Groups')).toBeInTheDocument();
    // Check for skeleton loading state
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays groups list when loaded', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<GroupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Group')).toBeInTheDocument();
      expect(screen.getByText('Another Group')).toBeInTheDocument();
      expect(screen.getByText('Empty Group')).toBeInTheDocument();
    });
  });

  it('displays group counts for each group', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<GroupsPage />);

    await waitFor(() => {
      // Check for event counts
      expect(screen.getByText('2 events')).toBeInTheDocument();
      expect(screen.getByText('1 event')).toBeInTheDocument();
      expect(screen.getByText('0 events')).toBeInTheDocument();
    });
  });

  it('navigates to group detail when group is clicked', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<GroupsPage />);

    await waitFor(() => {
      const groupButton = screen.getByText('Test Group');
      fireEvent.click(groupButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/group-123');
  });

  it('displays empty state when no groups', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue([]);

    render(<GroupsPage />);

    await waitFor(() => {
      expect(screen.getByText('No Groups Yet')).toBeInTheDocument();
      expect(screen.getByText(/Create your first group/)).toBeInTheDocument();
    });
  });

  it('shows create group button in empty state', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue([]);

    render(<GroupsPage />);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /create group/i });
      fireEvent.click(createButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/new');
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<GroupsPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
    expect(screen.getByText('Please sign in to view your groups')).toBeInTheDocument();
  });

  it('navigates to login when sign in button is clicked (unauthenticated)', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<GroupsPage />);

    const signInButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInButton);

    expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
  });

  it('shows new group button when authenticated and has groups', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<GroupsPage />);

    await waitFor(() => {
      const newGroupButton = screen.getByRole('button', { name: /new group/i });
      fireEvent.click(newGroupButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/new');
  });
});
