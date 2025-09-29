import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NewEventPage } from '../NewEventPage';
import { mockGroupsList } from '@/test/fixtures/groups';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
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
    createEvent: vi.fn(),
  },
  groupService: {
    getGroupsByOrganizer: vi.fn(),
  },
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('NewEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the new event form', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<NewEventPage />);

    expect(screen.getByText('New Event')).toBeInTheDocument();
    expect(screen.getByLabelText(/event name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date & time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create event/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty required fields', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<NewEventPage />);

    const submitButton = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Event name is required')).toBeInTheDocument();
      expect(screen.getByText('Date and time are required')).toBeInTheDocument();
      expect(screen.getByText('Location is required')).toBeInTheDocument();
    });
  });

  it('shows validation error for name too long', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<NewEventPage />);

    const nameInput = screen.getByLabelText(/event name/i);
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(201) } });

    const submitButton = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Event name must be 200 characters or less')).toBeInTheDocument();
    });
  });

  it('creates event successfully with valid data', async () => {
    const { eventService, groupService } = await import('@/services');
    const mockCreatedEvent = { id: 'new-event-123', name: 'Test Event' };
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);
    vi.mocked(eventService.createEvent).mockResolvedValue(mockCreatedEvent);

    render(<NewEventPage />);

    // Fill in the form
    const nameInput = screen.getByLabelText(/event name/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const datetimeInput = screen.getByLabelText(/date & time/i);
    const locationInput = screen.getByLabelText(/location/i);

    fireEvent.change(nameInput, { target: { value: 'Test Event' } });
    fireEvent.change(descriptionInput, { target: { value: 'A test event description' } });
    fireEvent.change(datetimeInput, { target: { value: '2024-12-01T14:00' } });
    fireEvent.change(locationInput, { target: { value: 'Test Location' } });

    const submitButton = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(eventService.createEvent).toHaveBeenCalledWith({
        name: 'Test Event',
        description: 'A test event description',
        datetime: '2024-12-01T14:00:00Z',
        location: 'Test Location',
        max_participants: null,
        is_private: false,
        group_id: null,
        custom_fields: [],
        organizer_id: 'user-123',
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/signup/new-event-123');
  });

  it('loads and displays available groups', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<NewEventPage />);

    await waitFor(() => {
      // Should show group selection
      expect(screen.getByText(/select group/i)).toBeInTheDocument();
    });
  });

  it('toggles privacy setting', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<NewEventPage />);

    await waitFor(() => {
      const privateButton = screen.getByRole('button', { name: /make private/i });
      fireEvent.click(privateButton);

      expect(screen.getByRole('button', { name: /make public/i })).toBeInTheDocument();
    });
  });

  it('adds custom form fields', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<NewEventPage />);

    await waitFor(() => {
      const addFieldButton = screen.getByRole('button', { name: /add custom field/i });
      fireEvent.click(addFieldButton);
    });

    expect(screen.getByLabelText(/field label/i)).toBeInTheDocument();
  });

  it('removes custom form fields', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<NewEventPage />);

    await waitFor(() => {
      const addFieldButton = screen.getByRole('button', { name: /add custom field/i });
      fireEvent.click(addFieldButton);
    });

    const removeFieldButton = screen.getByRole('button', { name: /remove field/i });
    fireEvent.click(removeFieldButton);

    expect(screen.queryByLabelText(/field label/i)).not.toBeInTheDocument();
  });

  it('shows loading state during form submission', async () => {
    const { eventService, groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);
    vi.mocked(eventService.createEvent).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<NewEventPage />);

    // Fill in required fields
    await waitFor(() => {
      const nameInput = screen.getByLabelText(/event name/i);
      fireEvent.change(nameInput, { target: { value: 'Test Event' } });
    });

    const datetimeInput = screen.getByLabelText(/date & time/i);
    const locationInput = screen.getByLabelText(/location/i);
    fireEvent.change(datetimeInput, { target: { value: '2024-12-01T14:00' } });
    fireEvent.change(locationInput, { target: { value: 'Test Location' } });

    const submitButton = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<NewEventPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });

  it('navigates back to events page when back button is clicked', async () => {
    const { groupService } = await import('@/services');
    vi.mocked(groupService.getGroupsByOrganizer).mockResolvedValue(mockGroupsList);

    render(<NewEventPage />);

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/events');
  });
});
