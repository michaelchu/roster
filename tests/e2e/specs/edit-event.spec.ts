import { test, expect } from '@playwright/test';
import { register, logout, clearAuth, getUserId } from '../fixtures/auth';
import { generateTestEmail, generateTestName, createTestEvent, getAdminDb } from '../fixtures/database';

test.describe('Edit Event Page', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Access Control', () => {
    test('requires authentication', async ({ page }) => {
      await page.goto('/events/some-event-id/edit');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('non-owner cannot edit event', async ({ page }) => {
      // Create event as one user
      const organizerUser = {
        email: generateTestEmail('event-owner'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Owner Event'),
      });

      await logout(page);

      // Try to edit as different user
      const otherUser = {
        email: generateTestEmail('other-user'),
        password: 'TestPassword123!',
      };
      await register(page, otherUser);

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForTimeout(2000);

      // Should redirect to events list
      expect(page.url()).not.toContain('/edit');
    });

    test('owner can access edit page', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('edit-owner'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('My Event'),
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Should see event name in form
      await expect(page.locator('#name')).toHaveValue(event.name);
    });
  });

  test.describe('Form Validation', () => {
    test('requires event name', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('name-required'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Validation Event'),
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Clear the name
      await page.fill('#name', '');

      // Try to save
      await page.click('button:has-text("Save Changes")');
      await page.waitForTimeout(1000);

      // Should show validation error toast
      const toast = page.locator('[data-sonner-toast]');
      await expect(toast).toBeVisible({ timeout: 5000 });
      await expect(toast).toContainText(/name.*required/i);

      // Should stay on edit page
      expect(page.url()).toContain('/edit');
    });
  });

  test.describe('Editing Fields', () => {
    test('can update event name', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('update-name'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Original Name'),
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Update name
      const newName = generateTestName('Updated Name');
      await page.fill('#name', newName);

      // Save changes
      await page.click('button:has-text("Save Changes")');
      await page.waitForURL(`**/signup/${event.id}`, { timeout: 10000 });

      // Verify name was updated
      await expect(page.getByText(newName)).toBeVisible();
    });

    test('can update description', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('update-desc'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Desc Event'),
        description: 'Original description',
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Update description
      await page.fill('#description', 'Updated description text');

      // Save changes
      await page.click('button:has-text("Save Changes")');
      await page.waitForURL(`**/signup/${event.id}`, { timeout: 10000 });

      // Verify description was updated
      await expect(page.getByText('Updated description text')).toBeVisible();
    });

    test('can update location', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('update-location'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Location Event'),
        location: 'Old Location',
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Update location
      await page.fill('#location', 'New Location 456 Main St');

      // Save changes
      await page.click('button:has-text("Save Changes")');
      await page.waitForURL(`**/signup/${event.id}`, { timeout: 10000 });

      // Verify location was updated
      await expect(page.getByText('New Location 456 Main St')).toBeVisible();
    });

    test('can toggle location TBD', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('location-tbd'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('TBD Location Event'),
        location: 'Some Location',
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Check TBD for location
      const locationTbdCheckbox = page
        .locator('label')
        .filter({ hasText: 'TBD' })
        .locator('button[role="checkbox"]')
        .last();
      await locationTbdCheckbox.click();

      // Save changes
      await page.click('button:has-text("Save Changes")');
      await page.waitForURL(`**/signup/${event.id}`, { timeout: 10000 });

      // Verify location shows TBD
      await expect(page.getByText('TBD').first()).toBeVisible();
    });
  });

  test.describe('Max Participants', () => {
    test('cannot reduce capacity below current registrations', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('capacity-limit'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Capacity Event'),
        max_participants: 10,
      });

      // Add 5 participants
      await getAdminDb()
        .from('participants')
        .insert([
          { event_id: event.id, name: 'P1', email: generateTestEmail('p1') },
          { event_id: event.id, name: 'P2', email: generateTestEmail('p2') },
          { event_id: event.id, name: 'P3', email: generateTestEmail('p3') },
          { event_id: event.id, name: 'P4', email: generateTestEmail('p4') },
          { event_id: event.id, name: 'P5', email: generateTestEmail('p5') },
        ]);

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Try to reduce capacity to 3
      const maxInput = page.locator('#max-participants-input');
      await maxInput.fill('3');

      // Save changes
      await page.click('button:has-text("Save Changes")');
      await page.waitForTimeout(1000);

      // Should show error toast
      const toast = page.locator('[data-sonner-toast]');
      await expect(toast).toBeVisible({ timeout: 5000 });
      await expect(toast).toContainText(/cannot reduce capacity|remove some participants/i);

      // Should stay on edit page
      expect(page.url()).toContain('/edit');
    });
  });

  test.describe('Delete Event', () => {
    test('shows confirmation dialog before deleting', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('delete-confirm'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Delete Test Event'),
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Click delete button
      await page.click('button:has-text("Delete Event")');

      // Confirmation dialog should appear
      await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /delete event/i }).last()).toBeVisible();
    });

    test('can cancel deletion', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('delete-cancel'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Keep Event'),
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Click delete button
      await page.click('button:has-text("Delete Event")');

      // Click cancel
      await page.click('button:has-text("Cancel")');

      // Should still be on edit page
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/edit');

      // Event should still exist
      const { data: eventStillExists } = await getAdminDb()
        .from('events')
        .select('id')
        .eq('id', event.id)
        .single();
      expect(eventStillExists).not.toBeNull();
    });

    test('deletes event after confirmation', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('delete-confirm-yes'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Event to Delete'),
      });

      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Click delete button
      await page.click('button:has-text("Delete Event")');

      // Confirm deletion
      await page.getByRole('button', { name: /delete event/i }).last().click();

      // Should redirect to events list
      await page.waitForURL('/events', { timeout: 10000 });

      // Event should be deleted
      const { data: deletedEvent } = await getAdminDb()
        .from('events')
        .select('id')
        .eq('id', event.id)
        .single();
      expect(deletedEvent).toBeNull();
    });
  });

  test.describe('Event Not Found', () => {
    test('shows not found message for non-existent event', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('not-found-edit'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      await page.goto('/events/non-existent-id/edit');
      await page.waitForTimeout(2000);

      // Either redirects to events or shows not found
      const showsNotFound = await page.getByText(/not found|don't have permission/i).isVisible();
      const redirectedAway = !page.url().includes('/edit');

      expect(showsNotFound || redirectedAway).toBe(true);
    });
  });
});
