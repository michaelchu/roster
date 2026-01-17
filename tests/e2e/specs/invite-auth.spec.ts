import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestEvent,
  createTestGroup,
  getAdminDb,
} from '../fixtures/database';

/**
 * Invite Authentication Flow E2E Tests
 *
 * Tests the complete flow of:
 * 1. Unauthenticated user visits event/group invite page
 * 2. Clicks "Sign in to RSVP" or "Sign in to join"
 * 3. Authenticates via login page (existing user) or registers (new user)
 * 4. Gets redirected back to invite page which then auto-redirects to event/group page
 *
 * Includes tests for:
 * - Existing user login from invite
 * - New user registration from invite (event and group)
 * - Unauthenticated user sees sign in button
 * - Already-registered user auto-redirect
 * - Edge cases (invalid links, returnUrl handling)
 */

test.describe('Event Invite Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Event Invite Flow', () => {
    test('redirects to event page after login from event invite', async ({ page }) => {
      // Step 1: Create a test organizer and event
      const organizerUser = {
        email: generateTestEmail('organizer'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);
      expect(organizerId).toBeTruthy();

      // Create event via database
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Invite Test Event'),
        description: 'Test event for invite flow',
        location: 'Test Location',
      });

      // Logout the organizer
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');
      const signOutButton = page.getByRole('button', { name: /sign out/i });
      await signOutButton.click();
      await page.waitForTimeout(1000);

      // Step 2: Visit invite page as unauthenticated user
      await page.goto(`/invite/event/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify we're on the invite page
      await expect(page.getByText('Event Invitation')).toBeVisible();
      await expect(page.getByText(event.name)).toBeVisible();

      // Step 3: Click "Sign in to manage RSVP" button (for standalone events)
      const signInButton = page.getByRole('button', { name: /sign in to rsvp/i });
      await expect(signInButton).toBeVisible();
      await signInButton.click();

      // Should navigate to login page with returnUrl pointing back to invite page
      await page.waitForURL(/\/auth\/login/);
      expect(page.url()).toContain(`returnUrl=%2Finvite%2Fevent%2F${event.id}`);

      // Step 4: Login with existing user credentials
      await page.fill('input[type="email"]', organizerUser.email);
      await page.fill('input[type="password"]', organizerUser.password);
      await page.click('button[type="submit"]');

      // Wait for redirect - should go directly to event signup page (auto-redirect for logged-in users)
      await page.waitForURL(new RegExp(`/signup/${event.id}`), { timeout: 5000 });

      // Step 5: Verify redirect to event signup page
      expect(page.url()).toContain(`/signup/${event.id}`);

      // Should see event details on signup page
      await expect(page.getByText(event.name)).toBeVisible();
    });

    test('unauthenticated user sees sign in button on event invite', async ({ page }) => {
      // Create event
      const organizerUser = {
        email: generateTestEmail('guest-organizer'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Sign In Event'),
        is_private: false,
      });

      // Logout
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');
      const signOutButton = page.getByRole('button', { name: /sign out/i });
      await signOutButton.click();
      await page.waitForTimeout(1000);

      // Visit invite page as unauthenticated user
      await page.goto(`/invite/event/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should see "Sign in to RSVP" button (no guest RSVP option)
      const signInButton = page.getByRole('button', { name: /sign in to rsvp/i });
      await expect(signInButton).toBeVisible();

      // Should NOT see "RSVP as Guest" button
      const guestButton = page.getByRole('button', { name: /rsvp as guest/i });
      await expect(guestButton).not.toBeVisible();
    });

    test('already registered user is auto-redirected to event page', async ({ page }) => {
      // Create organizer and event
      const organizerUser = {
        email: generateTestEmail('registered-organizer'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Already Registered Event'),
      });

      // Add organizer as participant
      const adminDb = getAdminDb();
      await adminDb.from('participants').insert({
        event_id: event.id,
        user_id: organizerId,
        name: 'Test Organizer',
        email: organizerUser.email,
        responses: {},
      });

      // Visit invite page while authenticated - should auto-redirect to event page
      await page.goto(`/invite/event/${event.id}`);

      // Should auto-redirect to event signup page
      await page.waitForURL(new RegExp(`/signup/${event.id}`), { timeout: 5000 });
      expect(page.url()).toContain(`/signup/${event.id}`);
    });
  });

  test.describe('New User Registration from Invite', () => {
    test('new user can register from event invite and gets redirected to event', async ({ page }) => {
      // Step 1: Create an event as organizer
      const organizerUser = {
        email: generateTestEmail('signup-organizer'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Signup Test Event'),
        description: 'Test event for new user signup flow',
        location: 'Test Location',
      });

      // Logout the organizer
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');
      const signOutButton = page.getByRole('button', { name: /sign out/i });
      await signOutButton.click();
      await page.waitForTimeout(1000);

      // Step 2: Visit invite page as unauthenticated user
      await page.goto(`/invite/event/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify we're on the invite page
      await expect(page.getByText('Event Invitation')).toBeVisible();

      // Step 3: Click "Sign in to manage RSVP" button
      const signInButton = page.getByRole('button', { name: /sign in to rsvp/i });
      await signInButton.click();

      // Should navigate to login page with returnUrl pointing back to invite page
      await page.waitForURL(/\/auth\/login/);
      expect(page.url()).toContain(`returnUrl=%2Finvite%2Fevent%2F${event.id}`);

      // Step 4: Click Sign Up link (should preserve returnUrl)
      await page.click('a:has-text("Sign Up")');
      await page.waitForURL(/\/auth\/register/);
      expect(page.url()).toContain(`returnUrl=%2Finvite%2Fevent%2F${event.id}`);

      // Step 5: Fill out registration form (using id selectors)
      const newUserEmail = generateTestEmail('new-invitee');
      await page.fill('#fullName', 'New Test User');
      await page.fill('#email', newUserEmail);
      await page.fill('#password', 'NewUserPassword123!');
      await page.click('button[type="submit"]');

      // Wait for registration and redirect - should go directly to event signup page
      await page.waitForURL(new RegExp(`/signup/${event.id}`), { timeout: 5000 });

      // Step 6: Verify redirect to event signup page (auto-redirect for logged-in users)
      expect(page.url()).toContain(`/signup/${event.id}`);

      // Verify user is logged in and on event signup page
      await expect(page.getByText(event.name)).toBeVisible();
    });

    test('new user can register from group invite and gets redirected to group', async ({ page }) => {
      // Step 1: Create a group as organizer
      const organizerUser = {
        email: generateTestEmail('group-signup-org'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);

      const group = await createTestGroup(organizerId!, {
        name: generateTestName('Signup Test Group'),
      });

      // Logout the organizer
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');
      const signOutButton = page.getByRole('button', { name: /sign out/i });
      await signOutButton.click();
      await page.waitForTimeout(1000);

      // Step 2: Visit group invite page as unauthenticated user
      await page.goto(`/invite/group/${group.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify we see sign-in prompt (groups require auth)
      const signInButton = page.getByRole('button', { name: /sign in to join/i });
      await expect(signInButton).toBeVisible();

      // Step 3: Click sign in button
      await signInButton.click();

      // Should navigate to login page with returnUrl pointing back to invite page
      await page.waitForURL(/\/auth\/login/);
      expect(page.url()).toContain(`returnUrl=%2Finvite%2Fgroup%2F${group.id}`);

      // Step 4: Click Sign Up link (should preserve returnUrl)
      await page.click('a:has-text("Sign Up")');
      await page.waitForURL(/\/auth\/register/);
      expect(page.url()).toContain(`returnUrl=%2Finvite%2Fgroup%2F${group.id}`);

      // Step 5: Fill out registration form (using id selectors)
      const newUserEmail = generateTestEmail('new-group-invitee');
      await page.fill('#fullName', 'New Group Member');
      await page.fill('#email', newUserEmail);
      await page.fill('#password', 'NewUserPassword123!');
      await page.click('button[type="submit"]');

      // Wait for registration and redirect - should auto-join and redirect to group page
      await page.waitForURL(new RegExp(`/groups/${group.id}`), { timeout: 5000 });

      // Step 6: Verify redirect to group page (auto-join + redirect for logged-in users)
      expect(page.url()).toContain(`/groups/${group.id}`);

      // Verify user is logged in and on group page
      await expect(page.getByText(group.name)).toBeVisible();

      // Step 7: Verify user was actually added to the group by checking database
      const adminDb = getAdminDb();
      const { data: membership } = await adminDb
        .from('group_participants')
        .select('*')
        .eq('group_id', group.id)
        .neq('user_id', organizerId) // Exclude organizer
        .single();

      expect(membership).toBeTruthy();
    });
  });

  test.describe('Edge Cases', () => {
    test('handles invalid invite link gracefully', async ({ page }) => {
      await page.goto('/invite/event/invalid-event-id-12345');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should show error message
      await expect(page.getByText(/event not found/i)).toBeVisible();

      // Should have option to go home
      const goHomeButton = page.getByRole('button', { name: /go home/i });
      await expect(goHomeButton).toBeVisible();
    });
  });
});
