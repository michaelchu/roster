import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { NotificationPreferences } from '../NotificationPreferences';
import { notificationPreferenceService } from '@/services';
import type { NotificationPreferences as NotificationPreferencesType } from '@/types/notifications';

// Mock services
vi.mock('@/services', () => ({
  notificationPreferenceService: {
    getOrCreatePreferences: vi.fn(),
    toggleNotificationType: vi.fn(),
  },
}));

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
  },
}));

const mockNotificationPreferenceService = vi.mocked(notificationPreferenceService);

const createMockPreferences = (
  overrides: Partial<NotificationPreferencesType> = {}
): NotificationPreferencesType => ({
  id: 'pref-1',
  user_id: 'user-1',
  push_enabled: true,
  notify_new_signup: true,
  notify_withdrawal: true,
  notify_payment_received: true,
  notify_capacity_reached: true,
  notify_signup_confirmed: true,
  notify_event_updated: true,
  notify_event_cancelled: true,
  notify_payment_reminder: true,
  notify_waitlist_promotion: true,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides,
});

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders loading skeleton while fetching preferences', async () => {
      // Never resolve to keep loading state
      mockNotificationPreferenceService.getOrCreatePreferences.mockImplementation(
        () => new Promise(() => {})
      );

      render(<NotificationPreferences />);

      // Should show skeleton elements
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });
  });

  describe('with preferences loaded', () => {
    it('renders master toggle when preferences are loaded', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences()
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByLabelText('Push notifications')).toBeInTheDocument();
      });
    });

    it('shows individual toggles when master toggle is enabled', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences({ push_enabled: true })
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByLabelText('Push notifications')).toBeInTheDocument();
      });

      // Organizer notifications
      expect(screen.getByLabelText('New signups')).toBeInTheDocument();
      expect(screen.getByLabelText('Withdrawals')).toBeInTheDocument();
      expect(screen.getByLabelText('Payments received')).toBeInTheDocument();
      expect(screen.getByLabelText('Capacity reached')).toBeInTheDocument();

      // Participant notifications
      expect(screen.getByLabelText('Signup confirmation')).toBeInTheDocument();
      expect(screen.getByLabelText('Event updates')).toBeInTheDocument();
      expect(screen.getByLabelText('Event cancellations')).toBeInTheDocument();
      expect(screen.getByLabelText('Payment reminders')).toBeInTheDocument();
      expect(screen.getByLabelText('Waitlist updates')).toBeInTheDocument();
    });

    it('hides individual toggles when master toggle is disabled', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences({ push_enabled: false })
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByLabelText('Push notifications')).toBeInTheDocument();
      });

      // Individual toggles should not be visible
      expect(screen.queryByLabelText('New signups')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Withdrawals')).not.toBeInTheDocument();
    });

    it('displays correct toggle states based on preferences', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences({
          push_enabled: true,
          notify_new_signup: true,
          notify_withdrawal: false,
        })
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByLabelText('Push notifications')).toBeInTheDocument();
      });

      const newSignupsToggle = screen.getByLabelText('New signups');
      const withdrawalsToggle = screen.getByLabelText('Withdrawals');

      expect(newSignupsToggle).toBeChecked();
      expect(withdrawalsToggle).not.toBeChecked();
    });
  });

  describe('toggle interactions', () => {
    it('calls toggleNotificationType when a toggle is clicked', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences({ push_enabled: true, notify_new_signup: true })
      );
      mockNotificationPreferenceService.toggleNotificationType.mockResolvedValue(
        createMockPreferences({ push_enabled: true, notify_new_signup: false })
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByLabelText('New signups')).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText('New signups');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockNotificationPreferenceService.toggleNotificationType).toHaveBeenCalledWith(
          'notify_new_signup',
          false
        );
      });
    });

    it('calls toggleNotificationType when master toggle is clicked', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences({ push_enabled: true })
      );
      mockNotificationPreferenceService.toggleNotificationType.mockResolvedValue(
        createMockPreferences({ push_enabled: false })
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByLabelText('Push notifications')).toBeInTheDocument();
      });

      const masterToggle = screen.getByLabelText('Push notifications');
      fireEvent.click(masterToggle);

      await waitFor(() => {
        expect(mockNotificationPreferenceService.toggleNotificationType).toHaveBeenCalledWith(
          'push_enabled',
          false
        );
      });
    });

    it('performs optimistic update on toggle click', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences({ push_enabled: true, notify_new_signup: true })
      );

      // Delay the response to verify optimistic update
      mockNotificationPreferenceService.toggleNotificationType.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(createMockPreferences({ push_enabled: true, notify_new_signup: false })),
              100
            )
          )
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByLabelText('New signups')).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText('New signups');
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);

      // Should immediately update (optimistic)
      expect(toggle).not.toBeChecked();
    });

    it('reverts optimistic update on error', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences({ push_enabled: true, notify_new_signup: true })
      );
      mockNotificationPreferenceService.toggleNotificationType.mockRejectedValue(
        new Error('Network error')
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByLabelText('New signups')).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText('New signups');
      expect(toggle).toBeChecked();

      fireEvent.click(toggle);

      // Optimistic update
      expect(toggle).not.toBeChecked();

      // Should revert after error
      await waitFor(() => {
        expect(toggle).toBeChecked();
      });
    });
  });

  describe('section headers', () => {
    it('displays organizer and participant section headers', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
        createMockPreferences({ push_enabled: true })
      );

      render(<NotificationPreferences />);

      await waitFor(() => {
        expect(screen.getByText('As an organizer')).toBeInTheDocument();
        expect(screen.getByText('As a participant')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('renders nothing when preferences fail to load', async () => {
      mockNotificationPreferenceService.getOrCreatePreferences.mockRejectedValue(
        new Error('Failed to load')
      );

      const { container } = render(<NotificationPreferences />);

      await waitFor(() => {
        // After error, component returns null (no content)
        expect(container.querySelector('.bg-card')).not.toBeInTheDocument();
      });
    });
  });
});
