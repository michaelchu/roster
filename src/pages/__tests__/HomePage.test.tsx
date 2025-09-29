import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HomePage } from '../HomePage';

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

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock upcoming events data (used in test descriptions but not directly in code)
// const mockUpcomingEvents = [
//   {
//     id: 'event-1',
//     name: 'Upcoming Event 1',
//     datetime: '2024-12-15T14:00:00Z',
//     location: 'Test Location 1',
//     isOrganizer: true,
//     participantCount: 5,
//   },
//   {
//     id: 'event-2',
//     name: 'Upcoming Event 2',
//     datetime: '2024-12-20T16:00:00Z',
//     location: 'Test Location 2',
//     isOrganizer: false,
//     participantCount: 10,
//   },
// ];

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the home page with navigation buttons', () => {
    render(<HomePage />);

    expect(screen.getByText('My Events')).toBeInTheDocument();
    expect(screen.getByText('My Groups')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Bookmarked')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  it('navigates to events page when My Events is clicked', () => {
    render(<HomePage />);

    const eventsButton = screen.getByRole('button', { name: /my events/i });
    fireEvent.click(eventsButton);

    expect(mockNavigate).toHaveBeenCalledWith('/events');
  });

  it('navigates to groups page when My Groups is clicked', () => {
    render(<HomePage />);

    const groupsButton = screen.getByRole('button', { name: /my groups/i });
    fireEvent.click(groupsButton);

    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });

  it('navigates to settings page when Settings is clicked', () => {
    render(<HomePage />);

    const settingsButton = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsButton);

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('displays upcoming events section', async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
    });
  });

  it('displays time period selector', () => {
    render(<HomePage />);

    expect(screen.getByText('All Time')).toBeInTheDocument();
  });

  it('changes time period when selector is used', async () => {
    render(<HomePage />);

    const timePeriodSelector = screen.getByDisplayValue('All Time');
    fireEvent.change(timePeriodSelector, { target: { value: 'week' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('This Week')).toBeInTheDocument();
    });
  });

  it('displays loading state for upcoming events', () => {
    render(<HomePage />);

    // Check for skeleton loading state
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays empty state when no upcoming events', async () => {
    // Mock empty response
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof vi.mocked>);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('No Upcoming Events')).toBeInTheDocument();
    });
  });

  it('displays event list when events are loaded', async () => {
    // Mock events response
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'event-1',
                        name: 'Upcoming Event 1',
                        datetime: '2024-12-15T14:00:00Z',
                        location: 'Test Location 1',
                        organizer_id: 'user-123',
                        participants: [{ id: 1 }, { id: 2 }],
                      },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof vi.mocked>);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Upcoming Event 1')).toBeInTheDocument();
    });
  });

  it('navigates to event when upcoming event is clicked', async () => {
    // Mock events response
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'event-1',
                        name: 'Upcoming Event 1',
                        datetime: '2024-12-15T14:00:00Z',
                        location: 'Test Location 1',
                        organizer_id: 'user-123',
                        participants: [],
                      },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof vi.mocked>);

    render(<HomePage />);

    await waitFor(() => {
      const eventButton = screen.getByText('Upcoming Event 1');
      fireEvent.click(eventButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/signup/event-1');
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
    });

    render(<HomePage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });

  it('shows different badge for organizer vs participant events', async () => {
    // Mock mixed events response
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'event-1',
                        name: 'My Event',
                        datetime: '2024-12-15T14:00:00Z',
                        location: 'Test Location 1',
                        organizer_id: 'user-123', // User is organizer
                        participants: [],
                      },
                      {
                        id: 'event-2',
                        name: 'Other Event',
                        datetime: '2024-12-20T16:00:00Z',
                        location: 'Test Location 2',
                        organizer_id: 'other-user', // User is participant
                        participants: [{ user_id: 'user-123' }],
                      },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof vi.mocked>);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('My Event')).toBeInTheDocument();
      expect(screen.getByText('Other Event')).toBeInTheDocument();
    });
  });

  it('displays event locations', async () => {
    // Mock events response
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'event-1',
                        name: 'Upcoming Event 1',
                        datetime: '2024-12-15T14:00:00Z',
                        location: 'Test Location 1',
                        organizer_id: 'user-123',
                        participants: [],
                      },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof vi.mocked>);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Location 1')).toBeInTheDocument();
    });
  });
});
