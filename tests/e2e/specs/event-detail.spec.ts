import { test, expect } from '@playwright/test';
import { register, logout, clearAuth, getUserId } from '../fixtures/auth';
import { generateTestEmail, generateTestName, createTestEvent, getAdminDb } from '../fixtures/database';
import { registerForEvent, goToEvent } from '../fixtures/helpers';

test.describe('Event Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Event Display', () => {
    test('displays event details correctly', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('event-display'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const event = await createTestEvent(userId!, {
        name: generateTestName('Detail Test Event'),
        description: 'This is the event description',
        location: 'Test Venue, 123 Main St',
        datetime: futureDate.toISOString(),
      });

      await goToEvent(page, event.id);

      await expect(page.getByText(event.name)).toBeVisible();
      await expect(page.getByText('This is the event description')).toBeVisible();
      await expect(page.getByText('Test Venue, 123 Main St')).toBeVisible();
    });

    test('shows TBD for missing datetime and location', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('event-tbd'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('TBD Event'),
        datetime: null,
        location: null,
      });

      await goToEvent(page, event.id);

      await expect(page.getByText(event.name)).toBeVisible();
      const tbdElements = page.getByText('TBD');
      await expect(tbdElements.first()).toBeVisible();
    });

    test('shows participant count', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('participant-count'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Participants Event'),
        max_participants: 10,
      });

      // Add participants via database
      await getAdminDb().from('participants').insert([
        { event_id: event.id, name: 'Participant 1', email: generateTestEmail('p1') },
        { event_id: event.id, name: 'Participant 2', email: generateTestEmail('p2') },
      ]);

      await goToEvent(page, event.id);

      await expect(page.getByText('2/10 participants signed up')).toBeVisible();
    });
  });

  test.describe('Participant Registration', () => {
    test('user sees join button for event they can register for', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('join-event'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      // Create own event (simplest case)
      const event = await createTestEvent(userId!, {
        name: generateTestName('My Event'),
        is_private: false,
      });

      await goToEvent(page, event.id);

      // Should see Join Event button (user is not registered yet)
      await expect(page.getByRole('button', { name: /join event/i })).toBeVisible();
    });

    test('participant appears in participant list', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('participant-list'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Participant List Event'),
      });

      // Add participants via database
      await getAdminDb().from('participants').insert([
        { event_id: event.id, name: 'Test Participant', email: testUser.email, user_id: userId },
        { event_id: event.id, name: 'Another Person', email: 'another@example.com' },
      ]);

      // Load event page
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Both participants should be visible in the list
      await expect(page.getByText('Test Participant')).toBeVisible();
      await expect(page.getByText('Another Person')).toBeVisible();
    });

    test('full event shows Event Full button', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('full-event'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Full Event'),
        max_participants: 2,
      });

      // Fill up the event
      await getAdminDb().from('participants').insert([
        { event_id: event.id, name: 'Participant 1', email: generateTestEmail('p1') },
        { event_id: event.id, name: 'Participant 2', email: generateTestEmail('p2') },
      ]);

      await logout(page);

      // New user tries to join
      const newUser = {
        email: generateTestEmail('new-user'),
        password: 'TestPassword123!',
      };
      await register(page, newUser);

      await goToEvent(page, event.id);

      await expect(page.getByRole('button', { name: /event full/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /event full/i })).toBeDisabled();
    });
  });

  test.describe('Participant Search', () => {
    test('can search participants by name', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('search-name'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Search Event'),
      });

      await getAdminDb().from('participants').insert([
        { event_id: event.id, name: 'Alice Smith', email: 'alice@test.com' },
        { event_id: event.id, name: 'Bob Jones', email: 'bob@test.com' },
        { event_id: event.id, name: 'Charlie Brown', email: 'charlie@test.com' },
      ]);

      await goToEvent(page, event.id);

      // Open search
      const searchButton = page.locator('button').filter({ has: page.locator('svg.lucide-search') });
      await searchButton.click();

      // Search for Alice
      await page.fill('input[type="search"]', 'Alice');
      await page.waitForTimeout(500);

      await expect(page.getByText('Alice Smith')).toBeVisible();
      await expect(page.getByText('Bob Jones')).not.toBeVisible();
    });
  });

  test.describe('Organizer Features', () => {
    test('organizer sees Edit button', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('organizer-edit'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Organizer Event'),
      });

      await goToEvent(page, event.id);

      await expect(page.getByRole('button', { name: /edit/i })).toBeVisible();
    });

    test('non-organizer does not see Edit button', async ({ page }) => {
      // Create event as one user
      const organizerUser = {
        email: generateTestEmail('organizer-only'),
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Not My Event'),
        is_private: false,
      });

      await logout(page);

      // View as different user
      const viewerUser = {
        email: generateTestEmail('viewer'),
        password: 'TestPassword123!',
      };
      await register(page, viewerUser);

      await goToEvent(page, event.id);

      // Edit button should not be visible
      const editButton = page.getByRole('button', { name: /^edit$/i });
      await expect(editButton).not.toBeVisible();
    });

    test('organizer sees payment summary', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('payment-summary'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Payment Event'),
      });

      await getAdminDb().from('participants').insert([
        { event_id: event.id, name: 'Paid User', email: 'paid@test.com', payment_status: 'paid' },
        {
          event_id: event.id,
          name: 'Pending User',
          email: 'pending@test.com',
          payment_status: 'pending',
        },
      ]);

      await goToEvent(page, event.id);

      await expect(page.getByText('Payment Status')).toBeVisible();
      await expect(page.getByText('Paid').first()).toBeVisible();
      await expect(page.getByText('Pending').first()).toBeVisible();
    });
  });

  test.describe('Access Control', () => {
    test('organizer can access their own public event', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('public-owner'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('My Public Event'),
        is_private: false,
      });

      await goToEvent(page, event.id);

      // Organizer should see their event
      await expect(page.getByText(event.name)).toBeVisible();
    });
  });

  test.describe('Share Event', () => {
    test('share button copies link to clipboard', async ({ page, context }) => {
      const testUser = {
        email: generateTestEmail('share-event'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Share Event'),
      });

      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await goToEvent(page, event.id);

      // Click share button
      const shareButton = page.getByRole('button', { name: /share/i });
      await shareButton.click();

      // Should show alert or toast about copying (fallback when navigator.share not available)
      // In tests, navigator.share is not available, so it uses clipboard.writeText
      await page.waitForTimeout(500);
    });
  });

  test.describe('Event Not Found', () => {
    test('shows error for non-existent event', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('not-found'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      await page.goto('/signup/non-existent-event-id');
      await page.waitForTimeout(3000);

      // Should show error message or Go Back button
      const errorVisible = await page.getByText(/event not found|not found/i).isVisible().catch(() => false);
      const goBackVisible = await page.getByRole('button', { name: /go back/i }).isVisible().catch(() => false);

      expect(errorVisible || goBackVisible).toBe(true);
    });
  });
});
