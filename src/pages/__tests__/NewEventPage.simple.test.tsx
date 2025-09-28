import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NewEventPage } from '../NewEventPage';
import { mockEvent } from '@/test/fixtures/events';
import type { Event } from '@/services';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseAuth = vi.fn(() => ({
  user: { id: 'user-123', email: 'test@example.com' },
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
}));

vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
  },
}));

const renderComponent = (ui: React.ReactElement) => {
  return render(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('NewEventPage Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create basic event successfully', async () => {
    const createdEvent: Event = {
      ...mockEvent,
      id: 'new-event-id',
      name: 'Test Event',
      organizer_id: 'user-123',
    };

    const { eventService } = await import('@/services');
    vi.mocked(eventService.createEvent).mockResolvedValue(createdEvent);

    renderComponent(<NewEventPage />);

    // Fill basic form
    await user.type(screen.getByLabelText(/event name/i), 'Test Event');

    // Submit
    const createButton = screen.getByRole('button', { name: /create event/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(eventService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Event',
          organizer_id: 'user-123',
        })
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/signup/new-event-id');
    });
  });

  it('should handle creation errors', async () => {
    const error = new Error('Creation failed');
    const { eventService } = await import('@/services');
    vi.mocked(eventService.createEvent).mockRejectedValue(error);

    renderComponent(<NewEventPage />);

    await user.type(screen.getByLabelText(/event name/i), 'Error Event');

    const createButton = screen.getByRole('button', { name: /create event/i });
    await user.click(createButton);

    await waitFor(async () => {
      const { errorHandler } = await import('@/lib/errorHandler');
      expect(errorHandler.handle).toHaveBeenCalledWith(error, {
        action: 'createEvent',
        userId: 'user-123',
      });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should render form elements', () => {
    renderComponent(<NewEventPage />);

    expect(screen.getByLabelText(/event name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create event/i })).toBeInTheDocument();
  });
});
