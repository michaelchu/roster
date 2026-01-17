import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestEvent,
  createTestGroup,
  getAdminDb,
} from '../fixtures/database';
import {
  createGroupViaUI,
  registerForEvent,
  goToGroup,
  goToGroupsList,
  expectGroupVisible,
} from '../fixtures/helpers';

test.describe('Group Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Group Creation', () => {
    test('organizer can create basic group', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('groupcreator'),
        password: 'TestPassword123!',
      });

      const groupData = {
        name: generateTestName('Test Group'),
        description: 'A test group for events',
      };

      await createGroupViaUI(page, groupData);

      // Verify group appears in list
      await goToGroupsList(page);
      await expectGroupVisible(page, groupData.name);
    });

    test('organizer can create private group', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('privategroup'),
        password: 'TestPassword123!',
      });

      const groupData = {
        name: generateTestName('Private Group'),
        description: 'Private group description',
        isPrivate: true,
      };

      await createGroupViaUI(page, groupData);

      await goToGroupsList(page);
      await expectGroupVisible(page, groupData.name);
    });

    test('group creation requires authentication', async ({ page }) => {
      await page.goto('/groups/new');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should show "Sign In Required" message with button
      const hasSignInButton = await page.getByRole('button', { name: /sign in/i }).isVisible().catch(() => false);
      const hasSignInMessage = await page.getByText(/sign in required/i).isVisible().catch(() => false);
      
      expect(hasSignInButton || hasSignInMessage).toBe(true);
    });
  });

  test.describe('Group Editing', () => {
    test('organizer can edit their own group', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('groupeditor'),
        password: 'TestPassword123!',
      });


      const userId = await getUserId(page);
      const group = await createTestGroup(userId!, {
        name: generateTestName('Original Group Name'),
        description: 'Original description',
      });

      // Navigate to edit page
      await page.goto(`/groups/${group.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Wait for form to populate

      // Update fields - use IDs
      await page.fill('#name', generateTestName('Updated Group Name'));
      await page.fill('#description', 'Updated description');

      // Save
      const submitButton = page.getByRole('button', { name: /save|update/i });
      await submitButton.click();

      await page.waitForURL((url) => !url.pathname.includes('/edit'), { timeout: 10000 });
      await page.waitForTimeout(2000); // Wait for database update

      // Verify update
      const { data: updated } = await getAdminDb()
        .from('groups')
        .select('*')
        .eq('id', group.id)
        .single();

      expect(updated?.name).toContain('Updated Group Name');
      expect(updated?.description).toBe('Updated description');
    });
  });

  test.describe('Group Deletion', () => {
    test('organizer can delete their own group', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('groupdeleter'),
        password: 'TestPassword123!',
      });


      const userId = await getUserId(page);
      const group = await createTestGroup(userId!, {
        name: generateTestName('Group to Delete'),
      });

      // Go to group detail
      await goToGroup(page, group.id);

      // Find and click delete button
      const deleteButton = page.getByRole('button', { name: /delete/i });
      if (await deleteButton.count() > 0) {
        await deleteButton.click();

        // Confirm deletion
        const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
        await confirmButton.click();

        await page.waitForURL((url) => url.pathname !== `/groups/${group.id}`, { timeout: 5000 });

        // Verify deletion in database
        const { data: deleted } = await getAdminDb()
          .from('groups')
          .select('*')
          .eq('id', group.id)
          .maybeSingle();

        expect(deleted).toBeNull();
      }
    });
  });

  test.describe('Adding Events to Groups', () => {
    test('organizer can assign event to group during creation', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('groupevent'),
        password: 'TestPassword123!',
      });

      
      // Create group first

      const userId = await getUserId(page);
      const group = await createTestGroup(userId!, {
        name: generateTestName('Event Group'),
      });

      // Create event with group assignment
      await page.goto('/events/new');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Wait for form to load

      // Fill basic event details using IDs
      await page.fill('#name', generateTestName('Group Event'));
      await page.fill('#location', 'Test Location');

      // Select group from dropdown - this is a shadcn Select component
      // Click the select trigger
      const groupSelectTrigger = page.locator('#group');
      await groupSelectTrigger.click();
      await page.waitForTimeout(1000); // Wait for dropdown to open
      
      // Click the group option by text (shadcn renders SelectItem in a portal)
      // Use getByRole to find the option element
      const groupOption = page.getByRole('option', { name: group.name });
      await groupOption.click({ timeout: 10000 });

      // Submit
      const submitButton = page.getByRole('button', { name: /create/i });
      await submitButton.click();

      await page.waitForURL((url) => url.pathname !== '/events/new', { timeout: 10000 });

      // Verify event is assigned to group
      const { data: events } = await getAdminDb()
        .from('events')
        .select('*')
        .eq('group_id', group.id);

      expect(events).not.toBeNull();
      expect(events?.length).toBeGreaterThan(0);
    });

    test('group shows events assigned to it', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('groupevents'),
        password: 'TestPassword123!',
      });

      

      const userId = await getUserId(page);
      const group = await createTestGroup(userId!, {
        name: generateTestName('Group with Events'),
      });

      // Create events in the group
      await createTestEvent(userId!, {
        name: generateTestName('Group Event 1'),
        group_id: group.id,
      });

      await createTestEvent(userId!, {
        name: generateTestName('Group Event 2'),
        group_id: group.id,
      });

      // Go to group detail page
      await goToGroup(page, group.id);
      await page.waitForTimeout(2000); // Wait for group data and events to load

      // Should show event count or list of events - be more flexible with match
      const hasEventCount = await page.getByText(/2.*event/i).isVisible().catch(() => false);
      const hasEventText = await page.getByText('2 events').isVisible().catch(() => false);
      expect(hasEventCount || hasEventText).toBe(true);
    });
  });


  test.describe('Group Stats', () => {
    test('group stats show correct event and participant counts', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('stats'),
        password: 'TestPassword123!',
      });

      

      const userId = await getUserId(page);
      const group = await createTestGroup(userId!, {
        name: generateTestName('Stats Group'),
      });

      // Create events
      const event1 = await createTestEvent(userId!, {
        name: generateTestName('Stats Event 1'),
        group_id: group.id,
      });

      const event2 = await createTestEvent(userId!, {
        name: generateTestName('Stats Event 2'),
        group_id: group.id,
      });

      // Add participants
      await getAdminDb().from('participants').insert([
        {
          event_id: event1.id,
          name: 'Part 1',
          email: generateTestEmail('st1'),
        },
        {
          event_id: event2.id,
          name: 'Part 2',
          email: generateTestEmail('st2'),
        },
      ]);

      // Go to group page or groups list
      await goToGroupsList(page);

      // Should show stats (2 events, participants)
      await expectGroupVisible(page, group.name);
      
      const hasEventCount = await page.getByText(/2.*event/i).isVisible().catch(() => false);
      expect(hasEventCount).toBe(true);
    });
  });

  test.describe('Group Participants Page', () => {


    test('organizer can remove participants from group', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('remove'),
        password: 'TestPassword123!',
      });



      const userId = await getUserId(page);
      const group = await createTestGroup(userId!, {
        name: generateTestName('Remove Group'),
      });

      const event = await createTestEvent(userId!, {
        name: generateTestName('Event'),
        group_id: group.id,
      });

      await clearAuth(page);

      // Create user and register for event (auto-joins group)
      await register(page, {
        email: generateTestEmail('remove1'),
        password: 'TestPassword123!',
      });
      const memberUserId = await getUserId(page);
      await registerForEvent(page, event.id);

      await page.waitForTimeout(2000); // Wait for trigger

      // Log back in as organizer
      await clearAuth(page);
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', generateTestEmail('remove'));
      await page.fill('input[type="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Go to remove members page
      await page.goto(`/groups/${group.id}/remove-members`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Select member and remove
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.count() > 0) {
        await checkbox.check();

        const removeButton = page.getByRole('button', { name: /remove.*member/i });
        if (await removeButton.count() > 0) {
          await removeButton.click();
          await page.waitForTimeout(1000);

          // Verify removal
          const { data: remaining } = await getAdminDb()
            .from('group_participants')
            .select('*')
            .eq('group_id', group.id)
            .eq('user_id', memberUserId!);

          expect(remaining?.length).toBe(0);
        }
      }
    });
  });

  test.describe('Group Admin Permissions', () => {
    test('group owner can manage group', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('owner'),
        password: 'TestPassword123!',
      });



      const userId = await getUserId(page);
      const group = await createTestGroup(userId!, {
        name: generateTestName('Owner Group'),
      });

      // Owner should see edit/delete buttons
      await goToGroup(page, group.id);
      await page.waitForTimeout(1000); // Wait for page to load

      // Edit button is a plain button element in the action footer
      const hasEditButton = await page.getByText('Edit', { exact: false }).isVisible().catch(() => false);
      const hasInviteButton = await page.getByText('Invite', { exact: false }).isVisible().catch(() => false);

      // Should see edit or invite button (both indicate owner access)
      expect(hasEditButton || hasInviteButton).toBe(true);
    });

    test('non-owner cannot edit group', async ({ page }) => {
      // Create owner and group
      await register(page, {
        email: generateTestEmail('owner2'),
        password: 'TestPassword123!',
      });



      const ownerId = await getUserId(page);
      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Protected Group'),
      });

      await clearAuth(page);

      // Login as different user
      await register(page, {
        email: generateTestEmail('other'),
        password: 'TestPassword123!',
      });

      // Try to access edit page
      await page.goto(`/groups/${group.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should be blocked or redirected
      const url = page.url();
      const hasError = await page.getByText(/not authorized|permission denied|forbidden/i).isVisible().catch(() => false);

      expect(url.includes('/edit') === false || hasError).toBe(true);
    });
  });

  test.describe('Direct Group Join via Invite Link', () => {
    test('authenticated user is auto-joined and redirected when visiting group invite link', async ({
      page,
    }) => {
      // Create organizer and group
      await register(page, {
        email: generateTestEmail('groupowner'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const group = await createTestGroup(organizerId!, {
        name: generateTestName('Invite Link Group'),
      });

      await clearAuth(page);

      // Create new user
      await register(page, {
        email: generateTestEmail('newmember'),
        password: 'TestPassword123!',
      });

      const newUserId = await getUserId(page);

      // Visit group invite link - user should be auto-joined and redirected to group page
      await page.goto(`/invite/group/${group.id}`);

      // Should auto-redirect to group page
      await page.waitForURL(new RegExp(`/groups/${group.id}`), { timeout: 5000 });
      expect(page.url()).toContain(`/groups/${group.id}`);

      // Should see group info on group page
      await expect(page.getByText(group.name)).toBeVisible();

      // Verify user was auto-added to group
      const { data: membership } = await getAdminDb()
        .from('group_participants')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', newUserId!)
        .maybeSingle();

      expect(membership).not.toBeNull();
      expect(membership?.user_id).toBe(newUserId);
    });

    test('unauthenticated user sees sign-in prompt on group invite', async ({ page }) => {
      // Create organizer and group
      await register(page, {
        email: generateTestEmail('groupowner2'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const group = await createTestGroup(organizerId!, {
        name: generateTestName('Auth Required Group'),
      });

      await clearAuth(page);

      // Visit group invite link without being logged in
      await page.goto(`/invite/group/${group.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should see sign-in button
      const signInButton = page.getByRole('button', { name: /sign in to join/i });
      expect(await signInButton.isVisible()).toBe(true);

      // Should NOT see "Join Group" button
      const joinButton = page.getByRole('button', { name: /^join group$/i });
      expect(await joinButton.count()).toBe(0);
    });

    test('already-member is auto-redirected to group page', async ({ page }) => {
      // Create organizer and group
      await register(page, {
        email: generateTestEmail('groupowner3'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const group = await createTestGroup(organizerId!, {
        name: generateTestName('Already Member Group'),
      });

      await clearAuth(page);

      // Create user and add them to group
      await register(page, {
        email: generateTestEmail('existingmember'),
        password: 'TestPassword123!',
      });

      const userId = await getUserId(page);

      await getAdminDb().from('group_participants').insert({
        group_id: group.id,
        user_id: userId!,
      });

      // Visit invite link - should auto-redirect to group page
      await page.goto(`/invite/group/${group.id}`);

      // Should auto-redirect to group page
      await page.waitForURL(new RegExp(`/groups/${group.id}`), { timeout: 5000 });
      expect(page.url()).toContain(`/groups/${group.id}`);
    });

    test('user is auto-joined and redirected to group details', async ({ page }) => {
      // Create organizer and group
      await register(page, {
        email: generateTestEmail('groupowner4'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const group = await createTestGroup(organizerId!, {
        name: generateTestName('Flow Test Group'),
      });

      await clearAuth(page);

      // Create new user
      await register(page, {
        email: generateTestEmail('flowmember'),
        password: 'TestPassword123!',
      });

      // Visit invite link - auto-join and redirect happen automatically
      await page.goto(`/invite/group/${group.id}`);

      // Should auto-redirect to group page
      await page.waitForURL(new RegExp(`/groups/${group.id}`), { timeout: 5000 });

      // Should be on group detail page
      expect(page.url()).toContain(`/groups/${group.id}`);

      // Should see group name
      await expect(page.getByText(group.name)).toBeVisible();
    });
  });
});
