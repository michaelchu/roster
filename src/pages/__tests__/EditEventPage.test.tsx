import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EditEventPage } from '../EditEventPage';
import { mockEvent } from '@/test/fixtures/events';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ eventId: 'V1StGXR8_Z' }),
  };
});

interface MockUser {
  id: string;
  email: string;
}

const mockUseAuth = vi.fn(() => ({
  user: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
  } as MockUser | null,
  loading: false,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/services', () => ({
  eventService: {
    getEventById: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('EditEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state initially', () => {
    render(<EditEventPage />);

    // Check for skeleton loading state
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('loads and displays event data', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Event')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A test event description')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Location')).toBeInTheDocument();
    });
  });

  it('shows validation errors for empty required fields', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Event');
      fireEvent.change(nameInput, { target: { value: '' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Event name is required')).toBeInTheDocument();
    });
  });

  it('shows validation error for name too long', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Event');
      fireEvent.change(nameInput, { target: { value: 'A'.repeat(201) } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Event name must be 200 characters or less')).toBeInTheDocument();
    });
  });

  it('updates event successfully', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(eventService.updateEvent).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Event');
      fireEvent.change(nameInput, { target: { value: 'Updated Event Name' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(eventService.updateEvent).toHaveBeenCalledWith(
        'V1StGXR8_Z',
        expect.objectContaining({
          name: 'Updated Event Name',
          description: 'A test event description',
          location: 'Test Location',
        })
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith('/signup/V1StGXR8_Z');
  });

  it('shows loading state during save', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(eventService.updateEvent).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<EditEventPage />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Event');
      fireEvent.change(nameInput, { target: { value: 'Updated Event Name' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });

  it('opens delete dialog when delete button is clicked', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: /delete event/i });
      fireEvent.click(deleteButton);
    });

    expect(screen.getByText('Delete Event')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  });

  it('deletes event when confirmed', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(eventService.deleteEvent).mockResolvedValue();

    render(<EditEventPage />);

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: /delete event/i });
      fireEvent.click(deleteButton);
    });

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(eventService.deleteEvent).toHaveBeenCalledWith('V1StGXR8_Z');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/events');
  });

  it('cancels delete dialog', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: /delete event/i });
      fireEvent.click(deleteButton);
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Delete Event')).not.toBeInTheDocument();
  });

  it('toggles privacy setting', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const privateButton = screen.getByRole('button', { name: /make private/i });
      fireEvent.click(privateButton);

      expect(screen.getByRole('button', { name: /make public/i })).toBeInTheDocument();
    });
  });

  it('adds custom form fields', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const addFieldButton = screen.getByRole('button', { name: /add custom field/i });
      fireEvent.click(addFieldButton);
    });

    expect(screen.getAllByLabelText(/field label/i)).toHaveLength(2); // One existing + one new
  });

  it('removes custom form fields', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const removeFieldButtons = screen.getAllByRole('button', { name: /remove field/i });
      fireEvent.click(removeFieldButtons[0]);
    });

    expect(screen.queryAllByLabelText(/field label/i)).toHaveLength(0);
  });

  it('redirects when event not found', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockRejectedValue(new Error('Event not found'));

    render(<EditEventPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events');
    });
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<EditEventPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });

  it('redirects when user is not the organizer', async () => {
    const { eventService } = await import('@/services');
    // Different user than the event organizer
    mockUseAuth.mockReturnValue({
      user: { id: 'different-user', email: 'different@example.com' } as MockUser | null,
      loading: false,
    });
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events');
    });
  });

  it('navigates back to event detail when back button is clicked', async () => {
    const { eventService } = await import('@/services');
    vi.mocked(eventService.getEventById).mockResolvedValue(mockEvent);

    render(<EditEventPage />);

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/signup/V1StGXR8_Z');
  });
});
