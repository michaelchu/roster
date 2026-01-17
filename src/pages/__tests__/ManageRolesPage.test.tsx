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
    user: { id: 'user-owner-123' },
    loading: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock services
vi.mock('@/services', () => ({
  groupService: {
    getGroupById: vi.fn(),
    getGroupAdmins: vi.fn(),
    getGroupParticipants: vi.fn(),
    addGroupAdmin: vi.fn(),
    removeGroupAdmin: vi.fn(),
  },
  organizerService: {
    getOrganizerDisplayName: vi.fn(),
  },
}));

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
  },
}));

import { ManageRolesPage } from '../ManageRolesPage';
import { groupService, organizerService } from '@/services';
import { useAuth } from '@/hooks/useAuth';
import { errorHandler } from '@/lib/errorHandler';

const mockGroupService = vi.mocked(groupService);
const mockOrganizerService = vi.mocked(organizerService);
const mockUseAuth = vi.mocked(useAuth);
const mockErrorHandler = vi.mocked(errorHandler);

describe('ManageRolesPage', () => {
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
    { id: 'admin-1', user_id: 'user-admin-1', group_id: 'group-123', created_at: '2024-01-01' },
  ];

  const mockMembers = [
    {
      id: 'member-1',
      name: 'Owner User',
      email: 'owner@test.com',
      user_id: 'user-owner-123',
      group_joined_at: '2024-01-01',
    },
    {
      id: 'member-2',
      name: 'Admin User',
      email: 'admin@test.com',
      user_id: 'user-admin-1',
      group_joined_at: '2024-01-02',
    },
    {
      id: 'member-3',
      name: 'Regular User',
      email: 'regular@test.com',
      user_id: 'user-regular-1',
      group_joined_at: '2024-01-03',
    },
    {
      id: 'member-4',
      name: 'Another User',
      email: 'another@test.com',
      user_id: 'user-another-1',
      group_joined_at: '2024-01-04',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupService.getGroupById.mockResolvedValue(mockGroup);
    mockGroupService.getGroupAdmins.mockResolvedValue(mockAdmins);
    mockGroupService.getGroupParticipants.mockResolvedValue(mockMembers as any);
    mockGroupService.addGroupAdmin.mockResolvedValue(undefined);
    mockGroupService.removeGroupAdmin.mockResolvedValue(undefined);
    mockOrganizerService.getOrganizerDisplayName.mockImplementation(async (userId) => {
      if (userId === 'user-owner-123') return 'Owner User';
      if (userId === 'user-admin-1') return 'Admin User';
      return 'Unknown';
    });
  });

  // Note: Loading state tests removed - they test implementation details (CSS class)
  // rather than behavior. The important behavior (redirects, data fetching) is
  // tested in the other describe blocks.

  describe('unauthorized state', () => {
    it('should redirect when user is not group owner', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-not-owner' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/groups');
      });
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });
  });

  describe('authorized owner view', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-owner-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('should display group owner section', async () => {
      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Group Owner')).toBeInTheDocument();
      });
      expect(screen.getByText('Owner User')).toBeInTheDocument();
      expect(screen.getByText('Full access to group')).toBeInTheDocument();
    });

    it('should display current admins section', async () => {
      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Current Admins (1)')).toBeInTheDocument();
      });
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Can manage members and events')).toBeInTheDocument();
    });

    it('should display no admins message when no admins exist', async () => {
      mockGroupService.getGroupAdmins.mockResolvedValue([]);

      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(
          screen.getByText('No admins yet. Promote members below to help manage this group.')
        ).toBeInTheDocument();
      });
    });

    it('should display eligible members to promote', async () => {
      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Promote Members to Admin/)).toBeInTheDocument();
      });

      // Regular User and Another User should be shown (not owner, not admin)
      expect(screen.getByText('Regular User')).toBeInTheDocument();
      expect(screen.getByText('Another User')).toBeInTheDocument();
    });

    it('should filter members by search query', async () => {
      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      await userEvent.type(searchInput, 'Another');

      expect(screen.queryByText('Regular User')).not.toBeInTheDocument();
      expect(screen.getByText('Another User')).toBeInTheDocument();
    });

    it('should show no members found when search has no results', async () => {
      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      await userEvent.type(searchInput, 'xyz123notfound');

      expect(screen.getByText('No members found')).toBeInTheDocument();
    });
  });

  describe('promoting members to admin', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-owner-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('should enable promote button when members are selected', async () => {
      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      // Find and click the checkbox for Regular User
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const promoteButton = screen.getByRole('button', { name: /Promote.*to Admin/i });
      expect(promoteButton).not.toBeDisabled();
    });

    it('should promote selected members to admin', async () => {
      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const promoteButton = screen.getByRole('button', { name: /Promote.*to Admin/i });
      await userEvent.click(promoteButton);

      await waitFor(() => {
        expect(mockGroupService.addGroupAdmin).toHaveBeenCalledWith('group-123', 'user-regular-1');
      });
      expect(mockErrorHandler.success).toHaveBeenCalledWith('Promoted 1 member to admin');
    });

    it('should handle promotion error', async () => {
      mockGroupService.addGroupAdmin.mockRejectedValue(new Error('Promotion failed'));

      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const promoteButton = screen.getByRole('button', { name: /Promote.*to Admin/i });
      await userEvent.click(promoteButton);

      await waitFor(() => {
        expect(mockErrorHandler.handle).toHaveBeenCalled();
      });
    });
  });

  describe('removing admin role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-owner-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('should remove admin when X button is clicked', async () => {
      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument();
      });

      // Find the remove button next to the admin - it's a ghost variant button with X icon
      // Exclude the Close button in TopNav (which has aria-label="Close")
      const removeButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('svg.lucide-x') && !btn.getAttribute('aria-label'));
      expect(removeButtons.length).toBeGreaterThan(0);

      await userEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(mockGroupService.removeGroupAdmin).toHaveBeenCalledWith('group-123', 'user-admin-1');
      });
      expect(mockErrorHandler.success).toHaveBeenCalledWith('Admin role removed');
    });

    it('should handle remove admin error', async () => {
      mockGroupService.removeGroupAdmin.mockRejectedValue(new Error('Remove failed'));

      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument();
      });

      // Find the remove button - exclude Close button
      const removeButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('svg.lucide-x') && !btn.getAttribute('aria-label'));
      await userEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(mockErrorHandler.handle).toHaveBeenCalled();
      });
    });
  });

  describe('error handling during load', () => {
    it('should redirect to groups page on load error', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-owner-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      mockGroupService.getGroupById.mockRejectedValue(new Error('Load failed'));

      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/groups');
      });
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });
  });

  describe('no eligible members', () => {
    it('should show message when no eligible members to promote', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-owner-123' } as any,
        loading: false,
        session: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithGoogle: vi.fn(),
        signInWithGoogleIdToken: vi.fn(),
        signOut: vi.fn(),
      });

      // Only owner and existing admin in members list
      mockGroupService.getGroupParticipants.mockResolvedValue([
        {
          id: 'member-1',
          name: 'Owner User',
          email: 'owner@test.com',
          user_id: 'user-owner-123',
          group_joined_at: '2024-01-01',
        },
        {
          id: 'member-2',
          name: 'Admin User',
          email: 'admin@test.com',
          user_id: 'user-admin-1',
          group_joined_at: '2024-01-02',
        },
      ] as any);

      render(<ManageRolesPage />);

      await waitFor(() => {
        expect(
          screen.getByText(
            'No eligible members to promote. Only registered members with accounts can become admins.'
          )
        ).toBeInTheDocument();
      });
    });
  });
});
