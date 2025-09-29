import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GroupDetailPage } from '../GroupDetailPage';
import { mockGroup } from '@/test/fixtures/groups';
import { mockEventsList } from '@/test/fixtures/events';

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
    getGroupEvents: vi.fn(),
    generateInviteLink: vi.fn(),
  },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('GroupDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state initially', () => {
    render(<GroupDetailPage />);

    // Check for skeleton loading state
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays group details when loaded', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupEvents).mockResolvedValue(mockEventsList);

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Group')).toBeInTheDocument();
      expect(screen.getByText('A test group for events')).toBeInTheDocument();
    });
  });

  it('displays group events when loaded', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupEvents).mockResolvedValue(mockEventsList);

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.getByText('Another Event')).toBeInTheDocument();
      expect(screen.getByText('Third Event')).toBeInTheDocument();
    });
  });

  it('navigates to event detail when event is clicked', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupEvents).mockResolvedValue(mockEventsList);

    render(<GroupDetailPage />);

    await waitFor(() => {
      const eventButton = screen.getByText('Test Event');
      fireEvent.click(eventButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/signup/V1StGXR8_Z');
  });

  it('shows add event button', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupEvents).mockResolvedValue(mockEventsList);

    render(<GroupDetailPage />);

    await waitFor(() => {
      const addEventButton = screen.getByRole('button', { name: /add event/i });
      fireEvent.click(addEventButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/events/new?group=group-123');
  });

  it('shows edit group button', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupEvents).mockResolvedValue(mockEventsList);

    render(<GroupDetailPage />);

    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: /edit group/i });
      fireEvent.click(editButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/group-123/edit');
  });

  it('shows participants button', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupEvents).mockResolvedValue(mockEventsList);

    render(<GroupDetailPage />);

    await waitFor(() => {
      const participantsButton = screen.getByRole('button', { name: /participants/i });
      fireEvent.click(participantsButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/groups/group-123/participants');
  });

  it('generates and copies invite link', async () => {
    const { groupService } = await import('@/services');
    const mockInviteLink = 'https://example.com/invite/group-123';
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupEvents).mockResolvedValue(mockEventsList);
    vi.mocked(groupService.generateInviteLink).mockResolvedValue(mockInviteLink);

    render(<GroupDetailPage />);

    await waitFor(() => {
      const shareButton = screen.getByRole('button', { name: /share/i });
      fireEvent.click(shareButton);
    });

    expect(groupService.generateInviteLink).toHaveBeenCalledWith('group-123');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockInviteLink);
  });

  it('displays empty state when no events in group', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockResolvedValue(mockGroup);
    vi.mocked(groupService.getGroupEvents).mockResolvedValue([]);

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('No Events Yet')).toBeInTheDocument();
      expect(screen.getByText(/Create your first event for this group/)).toBeInTheDocument();
    });
  });

  it('redirects to groups page when group is not found', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupById).mockRejectedValue(new Error('Group not found'));

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<GroupDetailPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });
});
