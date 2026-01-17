import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestGroup,
  getAdminDb,
} from '../fixtures/database';

/**
 * Member Management E2E Tests
 *
 * Tests the complete member management flows for groups:
 * 1. Promoting members to admin role
 * 2. Demoting admins (removing admin role)
 * 3. Removing members from groups (single and bulk)
 * 4. Quick actions visibility for admins vs non-admins
 * 5. Search and filter functionality on participants page
 * 6. Viewing current admins on manage roles page
 */

// Helper to register a user for an event (which auto-joins them to the group)
async function registerForEvent(page: ReturnType<typeof test.info>['project']['use']['page'] extends infer P ? P : never, eventId: string) {
  await page.goto(`/signup/${eventId}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Fill in participant name if required
  const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill('Test Participant');
  }

  // Submit the form
  const submitButton = page.getByRole('button', { name: /rsvp|sign up|register|submit/i });
  if (await submitButton.isVisible()) {
    await submitButton.click();
    await page.waitForTimeout(1000);
  }
}

// Helper to add a member directly to a group via database
// Note: name/email come from auth.users metadata, not stored in group_participants
async function addGroupMember(groupId: string, userId: string) {
  const adminDb = getAdminDb();
  await adminDb.from('group_participants').insert({
    group_id: groupId,
    user_id: userId,
  });
}

// Helper to add a group admin directly via database
async function addGroupAdmin(groupId: string, userId: string) {
  const adminDb = getAdminDb();
  await adminDb.from('group_admins').insert({
    group_id: groupId,
    user_id: userId,
  });
}

test.describe('Member Management', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Admin Role Management', () => {
    test('owner can promote member to admin', async ({ page }) => {
      // Step 1: Create owner and group
      const ownerUser = {
        email: generateTestEmail('owner-promote'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);
      expect(ownerId).toBeTruthy();

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Promote Test Group'),
      });

      // Step 2: Create a member user
      await clearAuth(page);
      const memberUser = {
        email: generateTestEmail('member-promote'),
        password: 'TestPassword123!',
      };
      await register(page, memberUser);
      const memberId = await getUserId(page);
      expect(memberId).toBeTruthy();

      // Add member to group directly
      await addGroupMember(group.id, memberId!);

      // Step 3: Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Step 4: Navigate to manage roles page
      await page.goto(`/groups/${group.id}/manage-roles`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Step 5: Verify page loaded with "Group Owner" section
      await expect(page.getByText('Group Owner')).toBeVisible();
      await expect(page.getByText('Owner', { exact: true })).toBeVisible();

      // Step 6: Verify "No admins yet" message
      await expect(page.getByText(/no admins yet/i)).toBeVisible();

      // Step 7: Find the member in the eligible members list and select them
      // Using role='checkbox' because this is a Radix UI Checkbox component
      const memberCheckbox = page.getByRole('checkbox').first();
      await memberCheckbox.click();

      // Step 8: Click Promote button
      const promoteButton = page.getByRole('button', { name: /promote.*admin/i });
      await expect(promoteButton).toBeEnabled();
      await promoteButton.click();
      await page.waitForTimeout(2000);

      // Step 9: Verify the member now appears in Current Admins section
      const currentAdminsSection = page.locator('text=Current Admins').locator('..');
      await expect(currentAdminsSection).toBeVisible();

      // Verify member is no longer in eligible members list (already promoted)
      await expect(page.getByText(/no admins yet/i)).not.toBeVisible();

      // Verify in database
      const { data: admins } = await getAdminDb()
        .from('group_admins')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', memberId!);

      expect(admins?.length).toBe(1);
    });

    test('owner can demote admin', async ({ page }) => {
      // Step 1: Create owner and group
      const ownerUser = {
        email: generateTestEmail('owner-demote'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);
      expect(ownerId).toBeTruthy();

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Demote Test Group'),
      });

      // Step 2: Create an admin user
      await clearAuth(page);
      const adminUser = {
        email: generateTestEmail('admin-demote'),
        password: 'TestPassword123!',
        fullName: 'Admin To Demote',
      };
      await register(page, adminUser);
      const adminId = await getUserId(page);
      expect(adminId).toBeTruthy();

      // Add as member and admin
      await addGroupMember(group.id, adminId!);
      await addGroupAdmin(group.id, adminId!);

      // Step 3: Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Step 4: Navigate to manage roles page
      await page.goto(`/groups/${group.id}/manage-roles`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Step 5: Verify admin appears in Current Admins section
      await expect(page.getByText('Current Admins')).toBeVisible();
      await expect(page.getByText('Admin To Demote')).toBeVisible({ timeout: 10000 });

      // Step 6: Click X button to remove admin role
      // The admin row contains the name, then sibling div with Badge and X button
      // Structure: div > (div.name + div.buttons > (Badge + Button.X))
      // Find the parent row that contains "Admin To Demote" text
      const adminItem = page.locator('.divide-y > div').filter({ hasText: 'Admin To Demote' }).first();
      const removeAdminButton = adminItem.getByRole('button');
      await removeAdminButton.click();
      await page.waitForTimeout(2000);

      // Step 7: Verify admin is no longer in Current Admins section
      // They should now appear in eligible members list
      await expect(page.getByText(/no admins yet/i)).toBeVisible();

      // Verify in database
      const { data: admins } = await getAdminDb()
        .from('group_admins')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', adminId!);

      expect(admins?.length).toBe(0);
    });

    test('non-owner cannot access manage roles page', async ({ page }) => {
      // Step 1: Create owner and group
      const ownerUser = {
        email: generateTestEmail('owner-nonaccess'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('NonAccess Test Group'),
      });

      // Step 2: Create a regular member
      await clearAuth(page);
      const memberUser = {
        email: generateTestEmail('member-nonaccess'),
        password: 'TestPassword123!',
      };
      await register(page, memberUser);
      const memberId = await getUserId(page);

      // Add as member only (not admin)
      await addGroupMember(group.id, memberId!);

      // Step 3: Try to access manage roles page as non-owner
      await page.goto(`/groups/${group.id}/manage-roles`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Should be redirected away or see unauthorized message
      const url = page.url();
      expect(url).not.toContain('/manage-roles');
    });
  });

  test.describe('Member Removal', () => {
    test('admin can remove single member from group', async ({ page }) => {
      // Step 1: Create owner and group with event
      const ownerUser = {
        email: generateTestEmail('owner-remove-single'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Remove Single Group'),
      });

      // Step 2: Create members
      await clearAuth(page);
      const member1 = {
        email: generateTestEmail('member1-remove'),
        password: 'TestPassword123!',
      };
      await register(page, member1);
      const member1Id = await getUserId(page);
      await addGroupMember(group.id, member1Id!);

      await clearAuth(page);
      const member2 = {
        email: generateTestEmail('member2-remove'),
        password: 'TestPassword123!',
      };
      await register(page, member2);
      const member2Id = await getUserId(page);
      await addGroupMember(group.id, member2Id!);

      // Step 3: Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Step 4: Navigate to remove members page
      await page.goto(`/groups/${group.id}/remove-members`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Step 5: Select one member (Radix UI Checkbox)
      const firstCheckbox = page.getByRole('checkbox').first();
      await firstCheckbox.click();

      // Step 6: Click remove button
      const removeButton = page.getByRole('button', { name: /remove.*member/i });
      await removeButton.click();
      await page.waitForTimeout(500);

      // Step 7: Confirm removal in dialog
      const confirmButton = page.getByRole('button', { name: 'Remove' });
      await confirmButton.click();
      await page.waitForTimeout(2000);

      // Verify one member was removed
      const { data: remaining } = await getAdminDb()
        .from('group_participants')
        .select('*')
        .eq('group_id', group.id);

      // Should have owner + 1 remaining member = less than what we started with
      expect(remaining?.filter(m => m.user_id !== ownerId).length).toBe(1);
    });

    test('admin can remove multiple members at once', async ({ page }) => {
      // Step 1: Create owner and group
      const ownerUser = {
        email: generateTestEmail('owner-remove-bulk'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Remove Bulk Group'),
      });

      // Step 2: Create multiple members
      const memberIds: string[] = [];
      for (let i = 1; i <= 3; i++) {
        await clearAuth(page);
        const member = {
          email: generateTestEmail(`member${i}-bulk`),
          password: 'TestPassword123!',
        };
        await register(page, member);
        const memberId = await getUserId(page);
        memberIds.push(memberId!);
        await addGroupMember(group.id, memberId!);
      }

      // Step 3: Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Step 4: Navigate to remove members page
      await page.goto(`/groups/${group.id}/remove-members`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Step 5: Select all members (Radix UI Checkbox)
      const checkboxes = page.getByRole('checkbox');
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).click();
      }

      // Verify selection count
      await expect(page.getByText(/\d+ members? selected/i)).toBeVisible();

      // Step 6: Click remove button
      const removeButton = page.getByRole('button', { name: /remove.*members?/i });
      await removeButton.click();
      await page.waitForTimeout(500);

      // Step 7: Confirm removal
      const confirmButton = page.getByRole('button', { name: 'Remove' });
      await confirmButton.click();
      await page.waitForTimeout(2000);

      // Verify all members were removed
      const { data: remaining } = await getAdminDb()
        .from('group_participants')
        .select('*')
        .eq('group_id', group.id);

      // Only owner should remain (if owner is in participants) or empty
      const nonOwnerMembers = remaining?.filter(m => m.user_id !== ownerId) || [];
      expect(nonOwnerMembers.length).toBe(0);
    });

    test('owner and admins are protected from removal', async ({ page }) => {
      // Step 1: Create owner and group
      const ownerUser = {
        email: generateTestEmail('owner-protected'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Protected Test Group'),
      });

      // Add owner to group_participants
      await addGroupMember(group.id, ownerId!);

      // Step 2: Create an admin
      await clearAuth(page);
      const adminUser = {
        email: generateTestEmail('admin-protected'),
        password: 'TestPassword123!',
      };
      await register(page, adminUser);
      const adminId = await getUserId(page);
      await addGroupMember(group.id, adminId!);
      await addGroupAdmin(group.id, adminId!);

      // Step 3: Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Step 4: Navigate to remove members page
      await page.goto(`/groups/${group.id}/remove-members`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Step 5: Verify owner and admin are NOT in the removable list
      // They should see "No Members to Remove" or only non-protected members
      const noMembersMessage = page.getByText(/no members to remove/i);
      const allProtectedMessage = page.getByText(/all current members are either the owner or admins/i);

      // Either no removable members or the protected message should be visible
      const hasNoMembers = await noMembersMessage.isVisible().catch(() => false);
      const hasProtectedMessage = await allProtectedMessage.isVisible().catch(() => false);

      expect(hasNoMembers || hasProtectedMessage).toBe(true);
    });
  });

  test.describe('Quick Actions Visibility', () => {
    test('admin sees quick actions on participants page', async ({ page }) => {
      // Step 1: Create owner and group with members
      const ownerUser = {
        email: generateTestEmail('owner-quickactions'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('QuickActions Group'),
      });

      // Add a member
      await clearAuth(page);
      const memberUser = {
        email: generateTestEmail('member-quickactions'),
        password: 'TestPassword123!',
      };
      await register(page, memberUser);
      const memberId = await getUserId(page);
      await addGroupMember(group.id, memberId!);

      // Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Navigate to participants page
      await page.goto(`/groups/${group.id}/participants`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify Quick Actions section is visible
      await expect(page.getByText('Quick Actions')).toBeVisible();

      // Verify Manage and Remove buttons are visible
      const manageButton = page.getByRole('button', { name: /manage/i });
      const removeButton = page.getByRole('button', { name: /remove/i });

      await expect(manageButton).toBeVisible();
      await expect(removeButton).toBeVisible();
    });

    test('non-admin does not see quick actions', async ({ page }) => {
      // Step 1: Create owner and group
      const ownerUser = {
        email: generateTestEmail('owner-noqa'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('NoQuickActions Group'),
      });

      // Step 2: Create a regular member (not admin)
      await clearAuth(page);
      const memberUser = {
        email: generateTestEmail('member-noqa'),
        password: 'TestPassword123!',
      };
      await register(page, memberUser);
      const memberId = await getUserId(page);
      await addGroupMember(group.id, memberId!);

      // Stay logged in as member and navigate to participants page
      await page.goto(`/groups/${group.id}/participants`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Quick Actions should NOT be visible
      const quickActionsVisible = await page.getByText('Quick Actions').isVisible().catch(() => false);
      expect(quickActionsVisible).toBe(false);
    });

    test('clicking Manage button navigates to manage-roles page', async ({ page }) => {
      // Create owner and group
      const ownerUser = {
        email: generateTestEmail('owner-manage-nav'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('ManageNav Group'),
      });

      // Navigate to participants page
      await page.goto(`/groups/${group.id}/participants`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Click Manage button
      const manageButton = page.getByRole('button', { name: /manage/i });
      await manageButton.click();
      await page.waitForURL(/\/manage-roles/);

      // Verify navigation
      expect(page.url()).toContain(`/groups/${group.id}/manage-roles`);
    });

    test('clicking Remove button navigates to remove-members page', async ({ page }) => {
      // Create owner and group with a member
      const ownerUser = {
        email: generateTestEmail('owner-remove-nav'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('RemoveNav Group'),
      });

      // Add a member so Remove button is enabled
      await clearAuth(page);
      const memberUser = {
        email: generateTestEmail('member-remove-nav'),
        password: 'TestPassword123!',
        fullName: 'Nav Test Member',
      };
      await register(page, memberUser);
      const memberId = await getUserId(page);
      await addGroupMember(group.id, memberId!);

      // Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Navigate to participants page
      await page.goto(`/groups/${group.id}/participants`);
      await page.waitForLoadState('domcontentloaded');

      // Wait for the member to appear (means data is loaded)
      await expect(page.getByText('Nav Test Member')).toBeVisible({ timeout: 10000 });

      // Click Remove button (should now be enabled since we have participants)
      const removeButton = page.getByRole('button', { name: /remove/i });
      await expect(removeButton).toBeEnabled({ timeout: 5000 });
      await removeButton.click();
      await page.waitForURL(/\/remove-members/);

      // Verify navigation
      expect(page.url()).toContain(`/groups/${group.id}/remove-members`);
    });
  });

  test.describe('Search and Filter', () => {
    test('can search members by name on participants page', async ({ page }) => {
      // Create owner and group with multiple members
      const ownerUser = {
        email: generateTestEmail('owner-search'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Search Group'),
      });

      // Create real member users (they need to be in auth.users to show in participants)
      await clearAuth(page);
      const aliceUser = {
        email: generateTestEmail('alice-search'),
        password: 'TestPassword123!',
        fullName: 'Alice Johnson',
      };
      await register(page, aliceUser);
      const aliceId = await getUserId(page);
      await addGroupMember(group.id, aliceId!);

      await clearAuth(page);
      const bobUser = {
        email: generateTestEmail('bob-search'),
        password: 'TestPassword123!',
        fullName: 'Bob Smith',
      };
      await register(page, bobUser);
      const bobId = await getUserId(page);
      await addGroupMember(group.id, bobId!);

      // Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Navigate to participants page
      await page.goto(`/groups/${group.id}/participants`);
      await page.waitForLoadState('domcontentloaded');

      // Wait for members to load (members display full_name from auth.users metadata)
      await expect(page.getByText('Alice Johnson')).toBeVisible({ timeout: 10000 });

      // Click search button to show search bar (it's the first button in the button group)
      const searchToggleButton = page.locator('.flex.border.border-border.rounded button').first();
      await searchToggleButton.click();
      await page.waitForTimeout(500);

      // Search for "Alice"
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('Alice');
      await page.waitForTimeout(500);

      // Verify only Alice is visible
      await expect(page.getByText('Alice Johnson')).toBeVisible();
      await expect(page.getByText('Bob Smith')).not.toBeVisible();
    });

    test('can search members on remove-members page', async ({ page }) => {
      // Create owner and group with members
      const ownerUser = {
        email: generateTestEmail('owner-search-remove'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('SearchRemove Group'),
      });

      // Create real member users (they need to be in auth.users to show in the list)
      await clearAuth(page);
      const dianaUser = {
        email: generateTestEmail('diana-search'),
        password: 'TestPassword123!',
        fullName: 'Diana Prince',
      };
      await register(page, dianaUser);
      const dianaId = await getUserId(page);
      await addGroupMember(group.id, dianaId!);

      await clearAuth(page);
      const edwardUser = {
        email: generateTestEmail('edward-search'),
        password: 'TestPassword123!',
        fullName: 'Edward Stark',
      };
      await register(page, edwardUser);
      const edwardId = await getUserId(page);
      await addGroupMember(group.id, edwardId!);

      // Log back in as owner
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', ownerUser.email);
      await page.fill('input[type="password"]', ownerUser.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Navigate to remove members page
      await page.goto(`/groups/${group.id}/remove-members`);
      await page.waitForLoadState('domcontentloaded');

      // Wait for members to load
      await expect(page.getByText('Diana Prince')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Edward Stark')).toBeVisible();

      // Search for "Diana"
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('Diana');
      await page.waitForTimeout(500);

      // Verify only Diana is visible
      await expect(page.getByText('Diana Prince')).toBeVisible();
      await expect(page.getByText('Edward Stark')).not.toBeVisible();
    });

    test('shows "no members found" when search has no results', async ({ page }) => {
      // Create owner and group with members
      const ownerUser = {
        email: generateTestEmail('owner-no-results'),
        password: 'TestPassword123!',
      };
      await register(page, ownerUser);
      const ownerId = await getUserId(page);

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('NoResults Group'),
      });

      // Add a member
      const adminDb = getAdminDb();
      await adminDb.from('group_participants').insert([
        { group_id: group.id, user_id: null, name: 'Test User', email: 'test@test.com' },
      ]);

      // Navigate to remove members page
      await page.goto(`/groups/${group.id}/remove-members`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Search for non-existent name
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('xyz123nonexistent');
      await page.waitForTimeout(500);

      // Verify "no members found" message
      await expect(page.getByText(/no members found/i)).toBeVisible();
    });
  });
});
