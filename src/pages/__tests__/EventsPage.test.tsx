import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EventsPage } from '../EventsPage';
import { mockEventsList } from '@/test/fixtures/events';

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
  eventService: {
    getEventsByOrganizer: vi.fn(),
    getEventsByParticipant: vi.fn(),
    duplicateEvent: vi.fn(),
  },
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state initially', () => {
    render(<EventsPage />);

    // EventsPage shows skeleton loading state, not text
    expect(screen.getAllByText('My Events')).toHaveLength(1);
    // Check for skeleton elements (they have animate-pulse class)
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays events list when loaded', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventsByOrganizer).mockResolvedValue(mockEventsList);
    vi.mocked(eventService.getEventsByParticipant).mockResolvedValue([]);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.getByText('Another Event')).toBeInTheDocument();
      expect(screen.getByText('Third Event')).toBeInTheDocument();
    });
  });

  it('displays participant counts for each event', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventsByOrganizer).mockResolvedValue(mockEventsList);
    vi.mocked(eventService.getEventsByParticipant).mockResolvedValue([]);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // First event count
      expect(screen.getAllByText('0')).toHaveLength(2); // Second and third event counts
    });
  });

  it('navigates to event detail page when event is clicked', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventsByOrganizer).mockResolvedValue(mockEventsList);
    vi.mocked(eventService.getEventsByParticipant).mockResolvedValue([]);

    render(<EventsPage />);

    await waitFor(() => {
      const eventButton = screen.getByText('Test Event');
      fireEvent.click(eventButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/signup/V1StGXR8_Z');
  });

  it('no longer has edit button in footer (removed in UI update)', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventsByOrganizer).mockResolvedValue(mockEventsList);
    vi.mocked(eventService.getEventsByParticipant).mockResolvedValue([]);

    render(<EventsPage />);

    await waitFor(() => {
      // Verify edit button no longer exists in the new UI
      const editButtons = screen.queryAllByRole('button', { name: /edit/i });
      expect(editButtons).toHaveLength(0);
    });
  });

  it('duplicates event when copy icon is clicked', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventsByOrganizer).mockResolvedValue(mockEventsList);
    vi.mocked(eventService.getEventsByParticipant).mockResolvedValue([]);
    vi.mocked(eventService.duplicateEvent).mockResolvedValue({
      ...mockEventsList[0],
      id: 'new-id',
    });

    render(<EventsPage />);

    await waitFor(() => {
      // Find copy icon buttons (they are in top-right corner with copy icon)
      const copyButtons = screen.getAllByRole('button');
      // Filter for the small icon buttons (they have specific classes)
      const copyIconButtons = copyButtons.filter(
        (button) =>
          button.classList.contains('absolute') &&
          button.classList.contains('top-2') &&
          button.classList.contains('right-2')
      );
      expect(copyIconButtons.length).toBeGreaterThan(0);
      fireEvent.click(copyIconButtons[0]);
    });

    await waitFor(() => {
      expect(eventService.duplicateEvent).toHaveBeenCalledWith('V1StGXR8_Z', 'user-123');
    });
  });

  it('displays empty state when no events', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventsByOrganizer).mockResolvedValue([]);
    vi.mocked(eventService.getEventsByParticipant).mockResolvedValue([]);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('No Events Yet')).toBeInTheDocument();
      expect(screen.getByText(/Create your first event/)).toBeInTheDocument();
    });
  });

  it('shows create event button in empty state', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventsByOrganizer).mockResolvedValue([]);
    vi.mocked(eventService.getEventsByParticipant).mockResolvedValue([]);

    render(<EventsPage />);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /create event/i });
      fireEvent.click(createButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/events/new');
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<EventsPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
    expect(screen.getByText('Please sign in to view your events')).toBeInTheDocument();
  });
});
