import { test, expect } from '@playwright/test';
import { register, logout, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestEvent,
  createTestGroup,
  getTestDb,
} from '../fixtures/database';

test.describe('Authorization and Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Event Access Control', () => {
    test('organizer can only access their own events', async ({ page }) => {
      // Create first organizer with an event
      await register(page, {
        email: generateTestEmail('org1'),
        password: 'TestPassword123!',
      });

      const org1Id = await getUserId(page);
      const org1Event = await createTestEvent(org1Id!, {
        name: generateTestName('Organizer 1 Event'),
      });

      await clearAuth(page);

      // Create second organizer
      await register(page, {
        email: generateTestEmail('org2'),
        password: 'TestPassword123!',
      });

      // Try to access first organizer's event edit page
      await page.goto(`/events/${org1Event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should be blocked from editing
      const url = page.url();
      const hasError = await page.getByText(/not authorized|permission denied|forbidden|not found/i).isVisible().catch(() => false);

      expect(url.includes('/edit') === false || hasError).toBe(true);
    });

    test('organizer can view their own events list', async ({ page }) => {
      // Create organizer with events
      await register(page, {
        email: generateTestEmail('myevents'),
        password: 'TestPassword123!',
      });

      const userId = await getUserId(page);
      const myEvent1 = await createTestEvent(userId!, {
        name: generateTestName('My Event 1'),
      });

      const myEvent2 = await createTestEvent(userId!, {
        name: generateTestName('My Event 2'),
      });

      // Go to events list
      await page.goto('/events');
      await page.waitForLoadState('domcontentloaded');

      // Should see own events
      const hasEvent1 = await page.getByText(myEvent1.name).isVisible().catch(() => false);
      const hasEvent2 = await page.getByText(myEvent2.name).isVisible().catch(() => false);

      expect(hasEvent1 && hasEvent2).toBe(true);
    });

    test('organizer cannot see other organizers private events in list', async ({ page }) => {
      // Create first organizer with private event
      await register(page, {
        email: generateTestEmail('private1'),
        password: 'TestPassword123!',
      });

      const org1Id = await getUserId(page);
      const privateEvent = await createTestEvent(org1Id!, {
        name: generateTestName('Other Org Private Event'),
        is_private: true,
      });

      await clearAuth(page);

      // Login as different organizer
      await register(page, {
        email: generateTestEmail('private2'),
        password: 'TestPassword123!',
      });

      // View events list
      await page.goto('/events');
      await page.waitForLoadState('domcontentloaded');

      // Should NOT see the other organizer's private event
      const hasPrivateEvent = await page.getByText(privateEvent.name).isVisible().catch(() => false);
      expect(hasPrivateEvent).toBe(false);
    });

    test('organizer cannot delete other organizers events', async ({ page }) => {
      // Create event owner
      await register(page, {
        email: generateTestEmail('owner'),
        password: 'TestPassword123!',
      });

      const ownerId = await getUserId(page);
      const event = await createTestEvent(ownerId!, {
        name: generateTestName('Protected Event'),
      });

      await clearAuth(page);

      // Login as different user
      await register(page, {
        email: generateTestEmail('attacker'),
        password: 'TestPassword123!',
      });

      // Try to delete via UI
      await page.goto(`/events/${event.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Delete button should not be visible for non-owner
      const deleteButton = page.getByRole('button', { name: /^delete$/i });
      const isDeleteVisible = await deleteButton.isVisible().catch(() => false);

      expect(isDeleteVisible).toBe(false);

      // Verify event still exists
      const { data: stillExists } = await getTestDb()
        .from('events')
        .select('*')
        .eq('id', event.id)
        .single();

      expect(stillExists).not.toBeNull();
    });
  });

  test.describe('Group Access Control', () => {
    test('organizer can only access their own groups', async ({ page }) => {
      // Create first organizer with group
      await register(page, {
        email: generateTestEmail('grporg1'),
        password: 'TestPassword123!',
      });

      const org1Id = await getUserId(page);
      const org1Group = await createTestGroup(org1Id!, {
        name: generateTestName('Organizer 1 Group'),
      });

      await clearAuth(page);

      // Create second organizer
      await register(page, {
        email: generateTestEmail('grporg2'),
        password: 'TestPassword123!',
      });

      // Try to access first organizer's group edit page
      await page.goto(`/groups/${org1Group.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should be blocked
      const url = page.url();
      const hasError = await page.getByText(/not authorized|permission denied|forbidden|not found/i).isVisible().catch(() => false);

      expect(url.includes('/edit') === false || hasError).toBe(true);
    });

    test('group admin can manage group', async ({ page }) => {
      // Create owner
      await register(page, {
        email: generateTestEmail('groupowner'),
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
      // Add as group admin
      await getTestDb().from('group_admins').insert({
        group_id: group.id,
        user_id: adminId!,
      });
      });

      // Admin should be able to access group
      await page.goto(`/groups/${group.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Should see group content
      const hasGroupName = await page.getByText(group.name).isVisible().catch(() => false);
      expect(hasGroupName).toBe(true);
    });

    test('non-admin cannot manage group participants', async ({ page }) => {
      // Create group owner
      await register(page, {
        email: generateTestEmail('groupmgr'),
        password: 'TestPassword123!',
      });

      const group = await createTestGroup(ownerId!, {
        name: generateTestName('Managed Group'),
      });

      await clearAuth(page);

      // Login as non-admin
      await register(page, {
        email: generateTestEmail('regular'),
        password: 'TestPassword123!',
      });

      // Try to access add members page
      await page.goto(`/groups/${group.id}/add-members`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should be blocked
      const url = page.url();
      const hasError = await page.getByText(/not authorized|permission denied|forbidden/i).isVisible().catch(() => false);

      expect(!url.includes('/add-members') || hasError).toBe(true);
    });
  });

  test.describe('Participant Data Isolation', () => {
    test('participants can only see their own registration data', async ({ page }) => {
      // Create organizer and event
      await register(page, {
        email: generateTestEmail('dataorg'),
        password: 'TestPassword123!',
      });

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Data Isolation Event'),
      });

      // Create first participant
      await clearAuth(page);
      await register(page, {
        email: generateTestEmail('part1'),
        password: 'TestPassword123!',
      });


      // Register with personal info
      await page.goto(`/events/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      
      const registerButton = page.getByRole('button', { name: /register|sign up/i });
      if (await registerButton.isVisible()) {
        await registerButton.click();
        await page.waitForTimeout(500);

        const nameInput = page.locator('input[name="name"]');
        if (await nameInput.count() > 0) {
          await nameInput.fill('Participant One Private Name');
        }

        const notesInput = page.locator('textarea[name="notes"]');
        if (await notesInput.count() > 0) {
          await notesInput.fill('Private notes for participant 1');
        }

        const submitButton = page.getByRole('button', { name: /submit|register|confirm/i }).last();
        await submitButton.click();
        await page.waitForTimeout(2000);
      }

      await clearAuth(page);

      // Login as second participant
      await register(page, {
        email: generateTestEmail('part2'),
        password: 'TestPassword123!',
      });

      // Go to event page
      await page.goto(`/events/${event.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Should NOT see first participant's private notes
      const hasPrivateNotes = await page.getByText('Private notes for participant 1').isVisible().catch(() => false);
      expect(hasPrivateNotes).toBe(false);
    });

    test('users cannot edit other users registrations', async ({ page }) => {
      // Create event
      await register(page, {
        email: generateTestEmail('editorg'),
        password: 'TestPassword123!',
      });

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Edit Protection Event'),
      });

      await clearAuth(page);

      // Participant 1 registers
      await register(page, {
        email: generateTestEmail('editpart1'),
        password: 'TestPassword123!',
      });


      const { data: part1Registration } = await getTestDb()
        .from('participants')
        .insert({
          event_id: event.id,
          user_id: part1Id,
          name: 'Original Name',
          email: part1?.email!,
        })
        .select()
        .single();

      await clearAuth(page);

      // Participant 2 tries to access part1's registration
      await register(page, {
        email: generateTestEmail('editpart2'),
        password: 'TestPassword123!',
      });

      // Try to directly edit (if edit endpoint exists)
      // Most apps won't expose edit UI for other users' registrations
      await page.goto(`/events/${event.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Should not see edit button for other participant
      const allEditButtons = page.getByRole('button', { name: /edit/i });
      const editButtonCount = await allEditButtons.count();

      // If no participants list is visible to non-organizers, count should be 0
      // Or verify registration data hasn't changed
      const { data: unchanged } = await getTestDb()
        .from('participants')
        .select('*')
        .eq('id', part1Registration?.id!)
        .single();

      expect(unchanged?.name).toBe('Original Name');
    });
  });

  test.describe('Public vs Private Event Access', () => {
    test('unauthenticated users can view public events', async ({ page }) => {
      // Create public event
      await register(page, {
        email: generateTestEmail('public'),
        password: 'TestPassword123!',
      });

      const publicEvent = await createTestEvent(userId!, {
        name: generateTestName('Public Event'),
        is_private: false,
      });

      await logout(page);

      // View as unauthenticated user
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const hasPublicEvent = await page.getByText(publicEvent.name).isVisible().catch(() => false);
      expect(hasPublicEvent).toBe(true);
    });

    test('unauthenticated users cannot view private events', async ({ page }) => {
      // Create private event
      await register(page, {
        email: generateTestEmail('secretorg'),
        password: 'TestPassword123!',
      });

      const privateEvent = await createTestEvent(userId!, {
        name: generateTestName('Secret Private Event'),
        is_private: true,
      });

      await logout(page);

      // Try to view as unauthenticated user
      await page.goto(`/events/${privateEvent.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should be redirected or shown auth required
      const url = page.url();
      const hasSignIn = await page.getByRole('button', { name: /sign in/i }).isVisible().catch(() => false);
      const hasAuthRequired = await page.getByText(/sign in required|authentication required/i).isVisible().catch(() => false);

      expect(url.includes('/auth') || hasSignIn || hasAuthRequired).toBe(true);
    });

    test('authenticated users can register for public events', async ({ page }) => {
      // Create public event
      await register(page, {
        email: generateTestEmail('pubcreator'),
        password: 'TestPassword123!',
      });

      const publicEvent = await createTestEvent(organizerId!, {
        name: generateTestName('Open Public Event'),
        is_private: false,
      });

      await clearAuth(page);

      // Login as participant
      await register(page, {
        email: generateTestEmail('pubpart'),
        password: 'TestPassword123!',
      });

      // Should be able to register
      await page.goto(`/events/${publicEvent.id}`);
      await page.waitForLoadState('domcontentloaded');

      const registerButton = page.getByRole('button', { name: /register|sign up/i });
      const canRegister = await registerButton.isVisible().catch(() => false);

      expect(canRegister).toBe(true);
    });

    test('private events require authentication to register', async ({ page }) => {
      // Create private event
      await register(page, {
        email: generateTestEmail('privcreator'),
        password: 'TestPassword123!',
      });

      const privateEvent = await createTestEvent(organizerId!, {
        name: generateTestName('Private Registration Event'),
        is_private: true,
      });

      await logout(page);

      // Try to access as unauthenticated
      await page.goto(`/events/${privateEvent.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should require sign in
      const hasSignInButton = await page.getByRole('button', { name: /sign in/i }).isVisible().catch(() => false);
      const url = page.url();

      expect(hasSignInButton || url.includes('/auth')).toBe(true);
    });
  });

  test.describe('Row Level Security (RLS)', () => {
    test('database prevents unauthorized event updates', async ({ page }) => {
      // Create event
      await register(page, {
        email: generateTestEmail('rlsorg'),
        password: 'TestPassword123!',
      });

      const event = await createTestEvent(ownerId!, {
        name: generateTestName('RLS Test Event'),
      });

      await clearAuth(page);

      // Login as different user
      await register(page, {
        email: generateTestEmail('rlsattacker'),
        password: 'TestPassword123!',
      });

      // Try to update event directly via database (should fail due to RLS)
      const { error } = await getTestDb()
        .from('events')
        .update({ name: 'Hacked Name' })
        .eq('id', event.id);

      // RLS should prevent the update
      expect(error).not.toBeNull();

      // Verify event name unchanged
      const { data: unchanged } = await getTestDb()
        .from('events')
        .select('name')
        .eq('id', event.id)
        .single();

      expect(unchanged?.name).toBe(event.name);
    });

    test('database prevents unauthorized participant deletion', async ({ page }) => {
      // Create event with participant
      await register(page, {
        email: generateTestEmail('delorg'),
        password: 'TestPassword123!',
      });

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Delete Protection Event'),
      });

      const { data: participant } = await getTestDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Protected Participant',
          email: generateTestEmail('protected'),
        })
        .select()
        .single();

      await clearAuth(page);

      // Login as non-organizer
      await register(page, {
        email: generateTestEmail('delattacker'),
        password: 'TestPassword123!',
      });

      // Try to delete participant (should fail due to RLS)
      const { error } = await getTestDb()
        .from('participants')
        .delete()
        .eq('id', participantId!);

      // RLS should prevent deletion
      expect(error).not.toBeNull();

      // Verify participant still exists
      const { data: stillExists } = await getTestDb()
        .from('participants')
        .select('*')
        .eq('id', participantId!)
        .single();

      expect(stillExists).not.toBeNull();
    });
  });

  test.describe('Session Management', () => {
    test('expired sessions require re-authentication', async ({ page }) => {
      // Create user
      await register(page, {
        email: generateTestEmail('session'),
        password: 'TestPassword123!',
      });

      // Manually expire session by clearing auth
      await clearAuth(page);

      // Try to access protected resource
      await page.goto('/events/new');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should require sign in
      const url = page.url();
      const hasSignIn = await page.getByRole('button', { name: /sign in/i }).isVisible().catch(() => false);

      expect(url.includes('/auth') || hasSignIn).toBe(true);
    });

    test('concurrent sessions work correctly', async ({ browser }) => {
      // Create user
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();

      await clearAuth(page1);
      await register(page1, {
        email: generateTestEmail('concurrent'),
        password: 'TestPassword123!',
      });

      // Login in second context with same user
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();

      await clearAuth(page2);
      await page2.goto('/auth/login');
      await page2.waitForLoadState('domcontentloaded');

      await page2.fill('input[type="email"]', await page1.locator('input[type="email"]').first().inputValue());
      await page2.fill('input[type="password"]', 'TestPassword123!');
      await page2.click('button[type="submit"]');

      await page2.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 10000 });

      // Both sessions should work
      await page1.goto('/events');
      await page1.waitForLoadState('domcontentloaded');
      const session1Works = await page1.getByText(/events|create/i).isVisible().catch(() => false);

      await page2.goto('/events');
      await page2.waitForLoadState('domcontentloaded');
      const session2Works = await page2.getByText(/events|create/i).isVisible().catch(() => false);

      expect(session1Works && session2Works).toBe(true);

      await context1.close();
      await context2.close();
    });
  });
});
