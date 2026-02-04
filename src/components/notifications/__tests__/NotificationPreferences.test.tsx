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
  throwIfSupabaseError: vi.fn((result) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }),
  requireData: vi.fn((data, operation) => {
    if (data === null || data === undefined) {
      throw new Error(`Failed to ${operation}`);
    }
    return data;
  }),
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

  it('hides individual toggles when master toggle is disabled', async () => {
    mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
      createMockPreferences({ push_enabled: false })
    );

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByLabelText('Push notifications')).toBeInTheDocument();
    });

    // Individual toggles should not be visible when master is off
    expect(screen.queryByLabelText('New signups')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Withdrawals')).not.toBeInTheDocument();
  });

  it('shows individual toggles when master toggle is enabled', async () => {
    mockNotificationPreferenceService.getOrCreatePreferences.mockResolvedValue(
      createMockPreferences({ push_enabled: true })
    );

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByLabelText('New signups')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Withdrawals')).toBeInTheDocument();
    expect(screen.getByLabelText('Event updates')).toBeInTheDocument();
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

    // Optimistic update - immediately unchecked
    expect(toggle).not.toBeChecked();

    // Should revert after error
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
  });
});
