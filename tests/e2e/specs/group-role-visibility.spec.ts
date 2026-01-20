import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestGroup,
  getAdminDb,
} from '../fixtures/database';
import { goToGroup } from '../fixtures/helpers';

test.describe('Group Role-Based UI Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Group Owner Visibility', () => {
    test('group owner sees Edit, Invite, and Add Event buttons', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('groupowner'),
        password: 'TestPassword123!',
      });

      const userId = await getUserId(page);
      const group = await createTestGroup(userId!, {
        name: generateTestName('Owner Test Group'),
      });

      await goToGroup(page, group.id);
      await page.waitForTimeout(1000);

      // Owner should see Edit button
      const editButton = page.getByText('Edit', { exact: true });
      await expect(editButton).toBeVisible();

      // Owner should see Invite button
      const inviteButton = page.getByText('Invite', { exact: true });
      await expect(inviteButton).toBeVisible();

      // Owner should see Members button
      const membersButton = page.getByText('Members', { exact: true });
      await expect(membersButton).toBeVisible();

      // Owner should see the FAB (Add Event button)
      const fabButton = page.locator('button[aria-label="Add Event"]');
      await expect(fabButton).toBeVisible();
    });
  });

  test.describe('Group Admin Visibility', () => {
    test('group admin sees Edit, Invite, and Add Event buttons', async ({ page }) => {
      // Create owner and group
      await register(page, {
        email: generateTestEmail('adminowner'),
        password: 'TestPassword123!',
      });

      const ownerId = await getUserId(page);
      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Admin Test Group'),
      });

      await clearAuth(page);

      // Create admin user
      await register(page, {
        email: generateTestEmail('groupadmin'),
        password: 'TestPassword123!',
      });

      const adminId = await getUserId(page);

      // Add user to group as member first
      await getAdminDb().from('group_participants').insert({
        group_id: group.id,
        user_id: adminId!,
      });

      // Add as group admin
      await getAdminDb().from('group_admins').insert({
        group_id: group.id,
        user_id: adminId!,
      });

      await goToGroup(page, group.id);
      await page.waitForTimeout(1000);

      // Admin should see Edit button
      const editButton = page.getByText('Edit', { exact: true });
      await expect(editButton).toBeVisible();

      // Admin should see Invite button
      const inviteButton = page.getByText('Invite', { exact: true });
      await expect(inviteButton).toBeVisible();

      // Admin should see Members button
      const membersButton = page.getByText('Members', { exact: true });
      await expect(membersButton).toBeVisible();

      // Admin should see the FAB (Add Event button)
      const fabButton = page.locator('button[aria-label="Add Event"]');
      await expect(fabButton).toBeVisible();
    });
  });

  test.describe('Regular Member Visibility', () => {
    test('regular member does NOT see Edit, Invite, or Add Event buttons', async ({ page }) => {
      // Create owner and group
      await register(page, {
        email: generateTestEmail('memberowner'),
        password: 'TestPassword123!',
      });

      const ownerId = await getUserId(page);
      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Member Test Group'),
      });

      await clearAuth(page);

      // Create regular member
      await register(page, {
        email: generateTestEmail('regularmember'),
        password: 'TestPassword123!',
      });

      const memberId = await getUserId(page);

      // Add user to group as regular member only (not admin)
      await getAdminDb().from('group_participants').insert({
        group_id: group.id,
        user_id: memberId!,
      });

      await goToGroup(page, group.id);
      await page.waitForTimeout(1000);

      // Regular member should NOT see Edit button
      const editButton = page.getByText('Edit', { exact: true });
      await expect(editButton).not.toBeVisible();

      // Regular member should NOT see Invite button
      const inviteButton = page.getByText('Invite', { exact: true });
      await expect(inviteButton).not.toBeVisible();

      // Regular member should still see Members button
      const membersButton = page.getByText('Members', { exact: true });
      await expect(membersButton).toBeVisible();

      // Regular member should NOT see the FAB (Add Event button)
      const fabButton = page.locator('button[aria-label="Add Event"]');
      await expect(fabButton).not.toBeVisible();
    });

    test('member who joined via invite link does NOT see admin buttons', async ({ page }) => {
      // Create owner and group
      await register(page, {
        email: generateTestEmail('inviteowner'),
        password: 'TestPassword123!',
      });

      const ownerId = await getUserId(page);
      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Invite Link Group'),
      });

      await clearAuth(page);

      // Create user who will join via invite link
      await register(page, {
        email: generateTestEmail('invitemember'),
        password: 'TestPassword123!',
      });

      const memberId = await getUserId(page);

      // Simulate joining via invite link (add to group_participants)
      await getAdminDb().from('group_participants').insert({
        group_id: group.id,
        user_id: memberId!,
      });

      // Navigate to group page
      await goToGroup(page, group.id);
      await page.waitForTimeout(1000);

      // Member should NOT see Edit button
      const editButton = page.getByText('Edit', { exact: true });
      await expect(editButton).not.toBeVisible();

      // Member should NOT see Invite button
      const inviteButton = page.getByText('Invite', { exact: true });
      await expect(inviteButton).not.toBeVisible();

      // Member should still see Members button
      const membersButton = page.getByText('Members', { exact: true });
      await expect(membersButton).toBeVisible();

      // Member should NOT see the FAB (Add Event button)
      const fabButton = page.locator('button[aria-label="Add Event"]');
      await expect(fabButton).not.toBeVisible();
    });
  });

  test.describe('Role Transition Visibility', () => {
    test('member promoted to admin gains access to admin buttons', async ({ page }) => {
      // Create owner and group
      await register(page, {
        email: generateTestEmail('promoteowner'),
        password: 'TestPassword123!',
      });

      const ownerId = await getUserId(page);
      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Promote Test Group'),
      });

      await clearAuth(page);

      // Create regular member
      await register(page, {
        email: generateTestEmail('promotemember'),
        password: 'TestPassword123!',
      });

      const memberId = await getUserId(page);

      // Add user to group as regular member only
      await getAdminDb().from('group_participants').insert({
        group_id: group.id,
        user_id: memberId!,
      });

      // First verify member doesn't see admin buttons
      await goToGroup(page, group.id);
      await page.waitForTimeout(1000);

      let editButton = page.getByText('Edit', { exact: true });
      await expect(editButton).not.toBeVisible();

      // Now promote to admin
      await getAdminDb().from('group_admins').insert({
        group_id: group.id,
        user_id: memberId!,
      });

      // Reload page to get updated permissions
      await page.reload();
      await page.waitForTimeout(1000);

      // Now should see admin buttons
      editButton = page.getByText('Edit', { exact: true });
      await expect(editButton).toBeVisible();

      const inviteButton = page.getByText('Invite', { exact: true });
      await expect(inviteButton).toBeVisible();

      const fabButton = page.locator('button[aria-label="Add Event"]');
      await expect(fabButton).toBeVisible();
    });
  });
});
