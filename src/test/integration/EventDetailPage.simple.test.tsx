import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { eventService, participantService, labelService } from '@/services';
import { useAuth } from '@/hooks/useAuth';

// Mock the services
vi.mock('@/services', () => ({
  eventService: {
    getEventById: vi.fn(),
  },
  participantService: {
    getParticipantsByEventId: vi.fn(),
    createParticipant: vi.fn(),
    updateParticipant: vi.fn(),
    deleteParticipant: vi.fn(),
    addLabelToParticipant: vi.fn(),
    removeLabelFromParticipant: vi.fn(),
  },
  labelService: {
    getLabelsByEventId: vi.fn(),
  },
}));

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
    })),
  },
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
    useLocation: () => mockUseLocation(),
  };
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('EventDetailPage Simple Integration Tests', () => {
  const mockEvent = {
    id: 'event-1',
    name: 'Test Event',
    description: 'A test event',
    datetime: '2024-12-25T10:00:00Z',
    location: 'Test Location',
    max_participants: 5,
    organizer_id: 'organizer-1',
    is_private: false,
    custom_fields: [],
  };

  const mockParticipants = [
    {
      id: 'participant-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      user_id: 'user-1',
      slot_number: 1,
      created_at: '2024-01-01T00:00:00Z',
      responses: {},
      labels: [],
    },
  ];

  const mockLabels = [{ id: 'label-1', name: 'VIP' }];

  const mockUser = {
    id: 'user-1',
    email: 'john@example.com',
    user_metadata: {
      full_name: 'John Doe',
      phone: '123-456-7890',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({ eventId: 'event-1' });
    mockUseLocation.mockReturnValue({ pathname: '/signup/event-1' });

    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
    });

    (eventService.getEventById as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvent);
    (participantService.getParticipantsByEventId as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockParticipants
    );
    (labelService.getLabelsByEventId as ReturnType<typeof vi.fn>).mockResolvedValue(mockLabels);
  });

  describe('Core Functionality', () => {
    it('renders event information successfully', async () => {
      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Event')).toBeInTheDocument();
      });

      expect(screen.getByText('A test event')).toBeInTheDocument();
      expect(screen.getByText('Test Location')).toBeInTheDocument();
    });

    it('loads and displays participants', async () => {
      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.getByText('1/5 participants signed up')).toBeInTheDocument();
    });

    it('transitions from loading to loaded state', async () => {
      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      // Should eventually load the actual content
      await waitFor(() => {
        expect(screen.getByText('Test Event')).toBeInTheDocument();
      });

      // And all the expected service calls should have been made
      expect(eventService.getEventById).toHaveBeenCalledWith('event-1');
      expect(participantService.getParticipantsByEventId).toHaveBeenCalledWith('event-1');
      expect(labelService.getLabelsByEventId).toHaveBeenCalledWith('event-1');
    });

    it('handles event not found', async () => {
      (eventService.getEventById as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Not found')
      );

      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Event not found')).toBeInTheDocument();
      });
    });

    it('handles private event access control', async () => {
      const privateEvent = { ...mockEvent, is_private: true };
      (eventService.getEventById as ReturnType<typeof vi.fn>).mockResolvedValue(privateEvent);
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null });

      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
      });
    });

    it('shows modify registration for existing participants', async () => {
      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Modify Registration')).toBeInTheDocument();
      });
    });

    it('shows join event for new users', async () => {
      const newUser = { ...mockUser, id: 'user-3' };
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: newUser });
      (participantService.getParticipantsByEventId as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Join Event')).toBeInTheDocument();
      });
    });

    it('loads all required data on mount', async () => {
      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(eventService.getEventById).toHaveBeenCalledWith('event-1');
        expect(participantService.getParticipantsByEventId).toHaveBeenCalledWith('event-1');
        expect(labelService.getLabelsByEventId).toHaveBeenCalledWith('event-1');
      });
    });

    it('handles service loading errors gracefully', async () => {
      (participantService.getParticipantsByEventId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Service error')
      );

      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      // Should still show event information even if participants fail to load
      await waitFor(() => {
        expect(screen.getByText('Test Event')).toBeInTheDocument();
      });
    });

    it('displays available spots correctly', async () => {
      const limitedParticipants = [mockParticipants[0]]; // Only 1 of 5 participants
      (participantService.getParticipantsByEventId as ReturnType<typeof vi.fn>).mockResolvedValue(
        limitedParticipants
      );

      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('1/5 participants signed up')).toBeInTheDocument();
      });

      // Should show available slots (expect multiple)
      const availableSlots = screen.getAllByText('Available slot');
      expect(availableSlots.length).toBeGreaterThan(0);
    });
  });

  describe('User Registration Status', () => {
    it('identifies user registration by user_id', async () => {
      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Modify Registration')).toBeInTheDocument();
      });
    });

    it('identifies user registration by email match', async () => {
      const participantWithoutUserId = {
        ...mockParticipants[0],
        user_id: null,
        email: 'john@example.com',
      };
      (participantService.getParticipantsByEventId as ReturnType<typeof vi.fn>).mockResolvedValue([
        participantWithoutUserId,
      ]);

      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Modify Registration')).toBeInTheDocument();
      });
    });

    it('shows join for users without registration', async () => {
      const differentUser = { ...mockUser, id: 'user-different', email: 'different@example.com' };
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: differentUser });

      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Join Event')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and Access Control', () => {
    it('shows back button for authenticated users', async () => {
      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Go back')).toBeInTheDocument();
      });
    });

    it('handles navbar visibility correctly', async () => {
      mockUseLocation.mockReturnValue({ pathname: '/auth/login' });

      render(
        <TestWrapper>
          <EventDetailPage />
        </TestWrapper>
      );

      // Should render without errors even when navbar is hidden
      await waitFor(() => {
        expect(screen.getByText('Test Event')).toBeInTheDocument();
      });
    });
  });
});
