import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestEvent,
  getAdminDb,
} from '../fixtures/database';
import { goToEvent, dismissAllToasts } from '../fixtures/helpers';

test.describe('Error Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Event Load Errors', () => {
    test('shows toast with error message and redirects for non-existent event', async ({
      page,
    }) => {
      const testUser = {
        email: generateTestEmail('event-not-found'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      // Dismiss any toasts from registration before testing error toasts
      await dismissAllToasts(page);

      // Navigate to a non-existent event
      await page.goto('/signup/00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      // Should show exactly one error toast with appropriate message
      const toasts = page.locator('[data-sonner-toast]');
      await expect(toasts.first()).toBeVisible({ timeout: 5000 });
      expect(await toasts.count()).toBe(1);
      await expect(toasts.first()).toContainText(/something went wrong|could not be found|try again/i);

      // Should eventually redirect to events list
      await page.waitForURL(/\/events$/, { timeout: 10000 });
      expect(page.url()).toContain('/events');
    });

    test('shows toast with error message and redirects for invalid event ID format', async ({
      page,
    }) => {
      const testUser = {
        email: generateTestEmail('invalid-event-id'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      // Dismiss any toasts from registration before testing error toasts
      await dismissAllToasts(page);

      await page.goto('/signup/invalid-id-format');
      await page.waitForLoadState('networkidle');

      // Should show exactly one error toast with appropriate message
      const toasts = page.locator('[data-sonner-toast]');
      await expect(toasts.first()).toBeVisible({ timeout: 5000 });
      expect(await toasts.count()).toBe(1);
      await expect(toasts.first()).toContainText(/something went wrong|could not be found|try again/i);

      // Should redirect to events list
      await page.waitForURL(/\/events$/, { timeout: 10000 });
      expect(page.url()).toContain('/events');
    });
  });

  test.describe('Group Load Errors', () => {
    test('shows toast with error message and redirects for non-existent group', async ({
      page,
    }) => {
      const testUser = {
        email: generateTestEmail('group-not-found'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      // Dismiss any toasts from registration before testing error toasts
      await dismissAllToasts(page);

      // Navigate to a non-existent group
      await page.goto('/groups/00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      // Should show exactly one error toast with appropriate message
      const toasts = page.locator('[data-sonner-toast]');
      await expect(toasts.first()).toBeVisible({ timeout: 5000 });
      expect(await toasts.count()).toBe(1);
      await expect(toasts.first()).toContainText(/something went wrong|could not be found|try again/i);

      // Should eventually redirect to groups list
      await page.waitForURL(/\/groups$/, { timeout: 10000 });
      expect(page.url()).toContain('/groups');
    });

    test('shows toast with error message and redirects for non-existent group participants page', async ({
      page,
    }) => {
      const testUser = {
        email: generateTestEmail('group-participants-not-found'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      // Dismiss any toasts from registration before testing error toasts
      await dismissAllToasts(page);

      // Navigate to participants page for non-existent group
      await page.goto('/groups/00000000-0000-0000-0000-000000000000/participants');
      await page.waitForLoadState('networkidle');

      // Should show exactly one error toast with appropriate message
      const toasts = page.locator('[data-sonner-toast]');
      await expect(toasts.first()).toBeVisible({ timeout: 5000 });
      expect(await toasts.count()).toBe(1);
      await expect(toasts.first()).toContainText(/something went wrong|could not be found|try again/i);

      // Should redirect to groups list
      await page.waitForURL(/\/groups$/, { timeout: 10000 });
      expect(page.url()).toContain('/groups');
    });
  });

  test.describe('Invite Page Errors', () => {
    test('shows toast with error message and redirects for non-existent group invite', async ({
      page,
    }) => {
      // Login first
      const testUser = {
        email: generateTestEmail('invite-group-not-found'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      // Dismiss any toasts from registration before testing error toasts
      await dismissAllToasts(page);

      await page.goto('/invite/group/00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      // Should show exactly one error toast with appropriate message
      const toasts = page.locator('[data-sonner-toast]');
      await expect(toasts.first()).toBeVisible({ timeout: 5000 });
      expect(await toasts.count()).toBe(1);
      await expect(toasts.first()).toContainText(/something went wrong|could not be found|try again/i);

      // Should redirect away from the invite page (to home or events)
      await expect(page).not.toHaveURL(/\/invite\//, { timeout: 10000 });
    });
  });

  test.describe('Signup Errors', () => {
    test('shows Event Full button when event is at capacity', async ({ page }) => {
      // Create organizer and event with 1 spot
      const organizerUser = {
        email: generateTestEmail('signup-full-org'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Full Event'),
        max_participants: 1,
        is_private: false,
      });

      // Fill up the event via database
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'First Participant',
        email: generateTestEmail('first-user'),
      });

      // Logout and register as a different user
      await clearAuth(page);
      const testUser = {
        email: generateTestEmail('new-user-full'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      // Go to event page - should see Event Full
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should see Event Full button (disabled)
      await expect(page.getByRole('button', { name: /event full/i })).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByRole('button', { name: /event full/i })).toBeDisabled();
    });
  });

  test.describe('Withdraw Errors', () => {
    test('withdraw handles race condition gracefully with appropriate feedback', async ({
      page,
    }) => {
      // Create organizer and event
      const organizerUser = {
        email: generateTestEmail('withdraw-error-org'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Withdraw Test Event'),
        is_private: false,
      });

      // Go to event page and join via UI
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Click Join Event button to register
      const joinButton = page.getByRole('button', { name: /join event/i });
      await joinButton.waitFor({ state: 'visible', timeout: 10000 });
      await joinButton.click();

      // Wait for join to complete - button should change to Withdraw or Modify Registration
      await page.waitForLoadState('networkidle');
      // Wait for the participants list to update (should show at least 1 participant now)
      await expect(page.getByText(/1 participant/i)).toBeVisible({ timeout: 10000 });

      // Get the participant ID for the race condition simulation
      const { data: participant } = await getAdminDb()
        .from('participants')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', organizerId)
        .single();

      // Should now see Modify Registration or Withdraw button (depends on feature flag)
      const mainActionButton = page.getByRole('button', { name: /withdraw|modify registration/i });
      await mainActionButton.waitFor({ state: 'visible', timeout: 10000 });
      await mainActionButton.click();

      // Wait for drawer/dialog to open
      await page.waitForTimeout(1000);

      // Delete the participant from database before confirming (simulate race condition)
      if (participant) {
        await getAdminDb().from('participants').delete().eq('id', participant.id);
      }

      // Now confirm the withdraw - either in a dialog (when registration_form is off)
      // or in a drawer (when registration_form is on). Both show "Withdraw" button.
      const withdrawConfirmButton = page.getByRole('button', { name: /^withdraw$/i }).last();
      await withdrawConfirmButton.waitFor({ state: 'visible', timeout: 5000 });
      await withdrawConfirmButton.click();

      // Wait for the response
      await page.waitForTimeout(3000);

      // The UI should update - either showing toast or showing Join Event button again
      const toasts = page.locator('[data-sonner-toast]');
      const joinButtonAfter = page.getByRole('button', { name: /join event/i });

      const toastVisible = await toasts.first().isVisible().catch(() => false);
      const joinButtonVisible = await joinButtonAfter.isVisible().catch(() => false);

      // If toast is visible, verify count and message
      if (toastVisible) {
        // Should show at most one toast
        expect(await toasts.count()).toBeLessThanOrEqual(1);
        // Toast should have either a success message or an error message
        await expect(toasts.first()).toContainText(
          /withdrawn|removed|something went wrong|try again|could not be found/i
        );
      }

      // Either we see a toast (success or error), or the UI updated to show Join Event again
      expect(toastVisible || joinButtonVisible).toBe(true);
    });
  });

  test.describe('Share/Copy Success Toast', () => {
    test('shows exactly one success toast when copying invite link', async ({ page, context }) => {
      const testUser = {
        email: generateTestEmail('share-toast'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Share Toast Event'),
      });

      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      // Dismiss any toasts before testing
      await dismissAllToasts(page);

      await goToEvent(page, event.id);

      // Click share button
      const shareButton = page.getByRole('button', { name: /share/i });
      await shareButton.click();

      // Should show exactly one success toast
      const toasts = page.locator('[data-sonner-toast]');
      await expect(toasts.first()).toBeVisible({ timeout: 5000 });
      expect(await toasts.count()).toBe(1);
      await expect(toasts.first()).toContainText(/copied|clipboard/i);
    });
  });
});
