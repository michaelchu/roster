import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GroupParticipantsPage } from '../GroupParticipantsPage';
import { mockGroup } from '@/test/fixtures/groups';
import { mockGroupParticipantsList } from '@/test/fixtures/groups';

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
    getGroupParticipants: vi.fn(),
  },
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('GroupParticipantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state initially', () => {
    render(<GroupParticipantsPage />);

    // Check for skeleton loading state
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays group participants when loaded', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
  });

  it('displays participant count in header', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Participants (2)')).toBeInTheDocument();
    });
  });

  it('toggles search bar visibility', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
    });

    expect(screen.getByPlaceholderText(/search participants/i)).toBeInTheDocument();

    // Click search button again to hide
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    expect(screen.queryByPlaceholderText(/search participants/i)).not.toBeInTheDocument();
  });

  it('filters participants by search query', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
    });

    const searchInput = screen.getByPlaceholderText(/search participants/i);
    fireEvent.change(searchInput, { target: { value: 'John' } });

    // Should show John Doe but not Jane Doe
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('opens sort drawer when sort button is clicked', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      const sortButton = screen.getByRole('button', { name: /sort/i });
      fireEvent.click(sortButton);
    });

    expect(screen.getByText('Sort by')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Oldest')).toBeInTheDocument();
    expect(screen.getByText('Name (A-Z)')).toBeInTheDocument();
    expect(screen.getByText('Name (Z-A)')).toBeInTheDocument();
  });

  it('changes sort option', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      const sortButton = screen.getByRole('button', { name: /sort/i });
      fireEvent.click(sortButton);
    });

    const nameAZButton = screen.getByText('Name (A-Z)');
    fireEvent.click(nameAZButton);

    // Sort drawer should close
    expect(screen.queryByText('Sort by')).not.toBeInTheDocument();
  });

  it('displays participant event information', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.getByText('Second Event')).toBeInTheDocument();
    });
  });

  it('displays empty state when no participants', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue([]);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      expect(screen.getByText('No Participants Yet')).toBeInTheDocument();
      expect(screen.getByText(/No one has joined this group/)).toBeInTheDocument();
    });
  });

  it('redirects when group not found', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockRejectedValue(new Error('Group not found'));

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<GroupParticipantsPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });

  it('navigates back to group detail when back button is clicked', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/group-123');
  });

  it('displays participant email addresses', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupParticipants).mockResolvedValue(mockGroupParticipantsList);

    render(<GroupParticipantsPage />);

    await waitFor(() => {
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });
  });
});
