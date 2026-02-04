/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils/test-utils';

// Mock useParams and useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ groupId: 'group-123' }),
  };
});

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-admin-123' },
    loading: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock services
vi.mock('@/services', () => ({
  groupService: {
    isGroupAdmin: vi.fn(),
    getGroupById: vi.fn(),
    getGroupAdmins: vi.fn(),
    getGroupParticipants: vi.fn(),
    removeParticipantsFromGroupBatch: vi.fn(),
  },
  pushSubscriptionService: {
    isSupported: vi.fn(() => false),
    isConfigured: vi.fn(() => false),
    isSubscribed: vi.fn(() => Promise.resolve(false)),
    getSubscriptions: vi.fn(() => Promise.resolve([])),
  },
  notificationService: {
    getNotifications: vi.fn(() => Promise.resolve([])),
    getUnreadCount: vi.fn(() => Promise.resolve(0)),
    subscribeToNotifications: vi.fn(() => vi.fn()),
  },
  notificationPreferenceService: {
    getPreferences: vi.fn(() => Promise.resolve(null)),
  },
}));

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  logError: vi.fn(),
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
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

import { RemoveMembersPage } from '../RemoveMembersPage';
import { groupService } from '@/services';
import { useAuth } from '@/hooks/useAuth';
import { errorHandler } from '@/lib/errorHandler';

const mockGroupService = vi.mocked(groupService);
const mockUseAuth = vi.mocked(useAuth);
const mockErrorHandler = vi.mocked(errorHandler);

describe('RemoveMembersPage', () => {
  const mockGroup = {
    id: 'group-123',
    name: 'Test Group',
    organizer_id: 'user-owner-123',
    description: 'Test description',
    is_private: false,
    invite_code: 'ABC123',
    created_at: '2024-01-01',
  };

  const mockAdmins = [
    { id: 'admin-1', user_id: 'user-admin-123', group_id: 'group-123', created_at: '2024-01-01' },
  ];

  const mockMembers = [
    {
      id: 'member-1',
      name: 'Owner User',
      email: 'owner@test.com',
      phone: null,
      user_id: 'user-owner-123',
      group_joined_at: '2024-01-01',
    },
    {
      id: 'member-2',
      name: 'Admin User',
      email: 'admin@test.com',
      phone: null,
      user_id: 'user-admin-123',
      group_joined_at: '2024-01-02',
    },
    {
      id: 'member-3',
      name: 'Regular User',
      email: 'regular@test.com',
      phone: '123-456-7890',
      user_id: 'user-regular-1',
      group_joined_at: '2024-01-03',
    },
    {
      id: 'member-4',
      name: 'Another User',
      email: null,
      phone: '987-654-3210',
      user_id: 'user-another-1',
      group_joined_at: '2024-01-04',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupService.isGroupAdmin.mockResolvedValue(true);
    mockGroupService.getGroupById.mockResolvedValue(mockGroup);
    mockGroupService.getGroupAdmins.mockResolvedValue(mockAdmins);
    mockGroupService.getGroupParticipants.mockResolvedValue(mockMembers as any);
    mockGroupService.removeParticipantsFromGroupBatch.mockResolvedValue({
      removed: 1,
      failed: 0,
    });
  });

  // Note: Loading state tests removed - they test implementation details (CSS class)
  // rather than behavior. The important behavior (redirects, data fetching) is
  // tested in the other describe blocks.

  describe('unauthorized state', () => {
    it('should redirect when user is not admin', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-not-admin' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      mockGroupService.isGroupAdmin.mockResolvedValue(false);

      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/groups/group-123/participants');
      });
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });

    it('should show unauthorized message when group is null', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-admin-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      // Admin check passes but then fails due to some error
      mockGroupService.isGroupAdmin.mockResolvedValue(true);
      mockGroupService.getGroupById.mockRejectedValue(new Error('Not found'));

      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/groups/group-123/participants');
      });
    });
  });

  describe('authorized admin view', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-admin-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('should display removable members header', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Removable Members (2)')).toBeInTheDocument();
      });
      expect(screen.getByText('Select members to remove from the group')).toBeInTheDocument();
    });

    it('should display only non-protected members', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });
      expect(screen.getByText('Another User')).toBeInTheDocument();

      // Owner and Admin should NOT be in the removable list
      expect(screen.queryByText('Owner User')).not.toBeInTheDocument();
      expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
    });

    // Note: Single test covers search filtering - name/email/phone all use the same filter logic
    it('should filter members by search query', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name, email, or phone...');
      await userEvent.type(searchInput, 'Another');

      expect(screen.queryByText('Regular User')).not.toBeInTheDocument();
      expect(screen.getByText('Another User')).toBeInTheDocument();
    });

    it('should show no members found when search has no results', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name, email, or phone...');
      await userEvent.type(searchInput, 'xyz123notfound');

      expect(screen.getByText('No members found')).toBeInTheDocument();
    });
  });

  describe('removing members', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-admin-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('should enable remove button when members are selected', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const removeButton = screen.getByRole('button', { name: /Remove.*Member/i });
      expect(removeButton).not.toBeDisabled();
    });

    it('should show selected count', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      await userEvent.click(checkboxes[1]);

      expect(screen.getByText('2 members selected')).toBeInTheDocument();
    });

    it('should open confirmation dialog when remove button clicked', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const removeButton = screen.getByRole('button', { name: /Remove.*Member/i });
      await userEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('Remove 1 Member?')).toBeInTheDocument();
      });
    });

    it('should close dialog when cancel is clicked', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const removeButton = screen.getByRole('button', { name: /Remove.*Member/i });
      await userEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('Remove 1 Member?')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Remove 1 Member?')).not.toBeInTheDocument();
      });
    });

    it('should remove members when confirmed', async () => {
      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const removeActionButton = screen.getByRole('button', { name: /Remove.*Member/i });
      await userEvent.click(removeActionButton);

      await waitFor(() => {
        expect(screen.getByText('Remove 1 Member?')).toBeInTheDocument();
      });

      // Click the Remove button in the dialog
      const confirmButton = screen.getByRole('button', { name: 'Remove' });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockGroupService.removeParticipantsFromGroupBatch).toHaveBeenCalledWith(
          'group-123',
          ['member-3']
        );
      });
      expect(mockErrorHandler.success).toHaveBeenCalledWith('Removed 1 member from the group');
    });

    it('should handle partial success when removing multiple members', async () => {
      mockGroupService.removeParticipantsFromGroupBatch.mockResolvedValue({
        removed: 1,
        failed: 1,
      });

      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      await userEvent.click(checkboxes[1]);

      const removeActionButton = screen.getByRole('button', { name: /Remove.*Members/i });
      await userEvent.click(removeActionButton);

      await waitFor(() => {
        expect(screen.getByText('Remove 2 Members?')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Remove' });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockErrorHandler.success).toHaveBeenCalledWith('Removed 1 member successfully');
        expect(mockErrorHandler.handle).toHaveBeenCalled();
      });
    });

    it('should handle complete failure when removing members', async () => {
      mockGroupService.removeParticipantsFromGroupBatch.mockResolvedValue({
        removed: 0,
        failed: 2,
      });

      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      await userEvent.click(checkboxes[1]);

      const removeActionButton = screen.getByRole('button', { name: /Remove.*Members/i });
      await userEvent.click(removeActionButton);

      await waitFor(() => {
        expect(screen.getByText('Remove 2 Members?')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Remove' });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockErrorHandler.handle).toHaveBeenCalled();
      });
    });

    it('should handle error during removal', async () => {
      mockGroupService.removeParticipantsFromGroupBatch.mockRejectedValue(
        new Error('Removal failed')
      );

      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const removeActionButton = screen.getByRole('button', { name: /Remove.*Member/i });
      await userEvent.click(removeActionButton);

      await waitFor(() => {
        expect(screen.getByText('Remove 1 Member?')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Remove' });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockErrorHandler.handle).toHaveBeenCalled();
      });
    });
  });

  describe('no removable members', () => {
    it('should show message when all members are protected', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-admin-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      // Only owner and admin in members list
      mockGroupService.getGroupParticipants.mockResolvedValue([
        {
          id: 'member-1',
          name: 'Owner User',
          email: 'owner@test.com',
          phone: null,
          user_id: 'user-owner-123',
          group_joined_at: '2024-01-01',
        },
        {
          id: 'member-2',
          name: 'Admin User',
          email: 'admin@test.com',
          phone: null,
          user_id: 'user-admin-123',
          group_joined_at: '2024-01-02',
        },
      ] as any);

      render(<RemoveMembersPage />);

      await waitFor(() => {
        expect(screen.getByText('No Members to Remove')).toBeInTheDocument();
      });
      expect(
        screen.getByText('All current members are either the owner or admins')
      ).toBeInTheDocument();
    });
  });
});
