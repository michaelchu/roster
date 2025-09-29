import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EventDetailPage } from '../EventDetailPage';
import { mockEvent, mockParticipantsList } from '@/test/fixtures/events';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ eventId: 'V1StGXR8_Z' }),
    useLocation: () => ({ pathname: '/events/V1StGXR8_Z' }),
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
    getEventById: vi.fn(),
    copyEventShareLink: vi.fn(),
  },
  participantService: {
    getParticipantsByEvent: vi.fn(),
    registerParticipant: vi.fn(),
    withdrawParticipant: vi.fn(),
    exportParticipantsCSV: vi.fn(),
  },
  labelService: {
    getLabelsByEvent: vi.fn(),
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

describe('EventDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state initially', () => {
    render(<EventDetailPage />);

    // Check for skeleton loading state
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays event details when loaded', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(mockParticipantsList);
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.getByText('A test event description')).toBeInTheDocument();
      expect(screen.getByText('Test Location')).toBeInTheDocument();
    });
  });

  it('displays participant count', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(mockParticipantsList);
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('3 / 50')).toBeInTheDocument();
    });
  });

  it('displays participant list', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(mockParticipantsList);
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });
  });

  it('shows edit button for event organizer', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    // Make the user the organizer
    const eventAsOrganizer = { ...mockEvent, organizer_id: 'user-123' };
    vi.mocked(eventService.getEventById).mockResolvedValue(eventAsOrganizer);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(mockParticipantsList);
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);

    render(<EventDetailPage />);

    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/events/V1StGXR8_Z/edit');
  });

  it('copies share link to clipboard', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(mockParticipantsList);
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);
    vi.mocked(eventService.copyEventShareLink).mockResolvedValue(
      'https://example.com/signup/V1StGXR8_Z'
    );

    render(<EventDetailPage />);

    await waitFor(() => {
      const shareButton = screen.getByRole('button', { name: /share/i });
      fireEvent.click(shareButton);
    });

    expect(eventService.copyEventShareLink).toHaveBeenCalledWith('V1StGXR8_Z');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/signup/V1StGXR8_Z'
    );
  });

  it('downloads participant CSV', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    // Make the user the organizer
    const eventAsOrganizer = { ...mockEvent, organizer_id: 'user-123' };
    vi.mocked(eventService.getEventById).mockResolvedValue(eventAsOrganizer);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(mockParticipantsList);
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);

    render(<EventDetailPage />);

    await waitFor(() => {
      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);
    });

    expect(participantService.exportParticipantsCSV).toHaveBeenCalledWith(
      'V1StGXR8_Z',
      'Test Event'
    );
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<EventDetailPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });

  it('redirects when event is not found', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockRejectedValue(new Error('Event not found'));

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events');
    });
  });

  it('shows full indicator when event is at capacity', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    const fullEvent = { ...mockEvent, max_participants: 1, participant_count: 1 };
    vi.mocked(eventService.getEventById).mockResolvedValue(fullEvent);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(
      mockParticipantsList.slice(0, 1)
    );
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Full')).toBeInTheDocument();
    });
  });

  it('displays event date and time', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(mockParticipantsList);
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);

    render(<EventDetailPage />);

    await waitFor(() => {
      // Should display formatted date (December 1, 2024)
      expect(screen.getByText(/December 1, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/2:00 PM/)).toBeInTheDocument();
    });
  });

  it('displays private event badge', async () => {
    const { eventService, participantService, labelService } = await import('@/services');
    const privateEvent = { ...mockEvent, is_private: true };
    vi.mocked(eventService.getEventById).mockResolvedValue(privateEvent);
    vi.mocked(participantService.getParticipantsByEvent).mockResolvedValue(mockParticipantsList);
    vi.mocked(labelService.getLabelsByEvent).mockResolvedValue([]);

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Private')).toBeInTheDocument();
    });
  });
});
