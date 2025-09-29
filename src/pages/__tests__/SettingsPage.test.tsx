import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';

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

const mockSignOut = vi.fn();
const mockUseAuth = vi.fn(() => ({
  user: { id: 'user-123', email: 'test@example.com' } as MockUser | null,
  loading: false,
  signOut: mockSignOut,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockSetFontSize = vi.fn();
vi.mock('@/hooks/useFontSize', () => ({
  useFontSize: () => ({
    fontSize: 'medium',
    setFontSize: mockSetFontSize,
    fontSizeLabels: {
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      'x-large': 'Extra Large',
    },
  }),
}));

const mockSetTheme = vi.fn();
vi.mock('@/components/theme-provider', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: mockSetTheme,
  }),
}));

// Custom render without AuthProvider since we're mocking it
const render = (ui: React.ReactElement) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the settings page with all sections', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Event Management')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('displays user email in notifications section', () => {
    render(<SettingsPage />);

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('toggles email notifications', () => {
    render(<SettingsPage />);

    const emailToggle = screen.getByRole('switch', { name: /email notifications/i });
    expect(emailToggle).toBeChecked(); // Default is true

    fireEvent.click(emailToggle);
    expect(emailToggle).not.toBeChecked();
  });

  it('toggles SMS notifications', () => {
    render(<SettingsPage />);

    const smsToggle = screen.getByRole('switch', { name: /sms notifications/i });
    expect(smsToggle).not.toBeChecked(); // Default is false

    fireEvent.click(smsToggle);
    expect(smsToggle).toBeChecked();
  });

  it('changes font size using slider', () => {
    render(<SettingsPage />);

    const fontSizeSlider = screen.getByRole('slider', { name: /font size/i });

    // Simulate changing font size
    fireEvent.change(fontSizeSlider, { target: { value: '2' } }); // Large

    expect(mockSetFontSize).toHaveBeenCalledWith('large');
  });

  it('displays current font size label', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('changes theme', () => {
    render(<SettingsPage />);

    const themeSelect = screen.getByDisplayValue('Light');
    fireEvent.change(themeSelect, { target: { value: 'dark' } });

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('changes max participants setting', () => {
    render(<SettingsPage />);

    const maxParticipantsInput = screen.getByDisplayValue('50');
    fireEvent.change(maxParticipantsInput, { target: { value: '100' } });

    expect(maxParticipantsInput).toHaveValue(100);
  });

  it('navigates to profile when profile button is clicked', () => {
    render(<SettingsPage />);

    const profileButton = screen.getByRole('button', { name: /profile/i });
    fireEvent.click(profileButton);

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('signs out user when sign out button is clicked', async () => {
    render(<SettingsPage />);

    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it('displays loading state when user data is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      signOut: mockSignOut,
    });

    render(<SettingsPage />);

    // Check for skeleton loading state
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays sign in prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null as MockUser | null,
      loading: false,
      signOut: mockSignOut,
    });

    render(<SettingsPage />);

    expect(screen.getByText('Sign In Required')).toBeInTheDocument();
  });

  it('shows platform information in About section', () => {
    render(<SettingsPage />);

    expect(screen.getByText(/Roster is a mobile event management platform/)).toBeInTheDocument();
    expect(screen.getByText(/For the best experience/)).toBeInTheDocument();
  });

  it('changes max participants validation range', () => {
    render(<SettingsPage />);

    const maxParticipantsInput = screen.getByDisplayValue('50');

    // Test minimum value
    fireEvent.change(maxParticipantsInput, { target: { value: '0' } });
    fireEvent.blur(maxParticipantsInput);
    expect(maxParticipantsInput).toHaveValue(1);

    // Test maximum value
    fireEvent.change(maxParticipantsInput, { target: { value: '200' } });
    fireEvent.blur(maxParticipantsInput);
    expect(maxParticipantsInput).toHaveValue(100);
  });

  it('displays version information', () => {
    render(<SettingsPage />);

    expect(screen.getByText(/Version/)).toBeInTheDocument();
  });

  it('shows font size preview text', () => {
    render(<SettingsPage />);

    expect(screen.getByText(/Preview text to see how content appears/)).toBeInTheDocument();
  });

  it('toggles auto-create participant labels', () => {
    render(<SettingsPage />);

    const autoCreateToggle = screen.getByRole('switch', {
      name: /auto-create participant labels/i,
    });

    fireEvent.click(autoCreateToggle);
    // Should toggle the state (specific behavior depends on implementation)
  });

  it('displays all appearance options', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Font Size')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Light')).toBeInTheDocument();
  });

  it('shows max participants explanation text', () => {
    render(<SettingsPage />);

    expect(screen.getByText(/Default maximum number of participants/)).toBeInTheDocument();
  });
});
