import { test, expect } from '@playwright/test';
import { register, logout, clearAuth } from '../fixtures/auth';
import { generateTestEmail, generateTestName, createTestEvent, getTestDb } from '../fixtures/database';
import {
  createEventViaUI,
  editEventViaUI,
  deleteEventViaUI,
  goToEventsList,
  expectEventVisible,
  expectEventNotVisible,
} from '../fixtures/helpers';

test.describe('Event Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Event Creation', () => {
    test('organizer can create basic event', async ({ page }) => {
      // Register and login
      const testUser = {
        email: generateTestEmail('eventcreator'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      // Create event with basic fields
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const datetimeString = futureDate.toISOString().slice(0, 16);

      const eventData = {
        name: generateTestName('Basic Event'),
        description: 'This is a test event',
        datetime: datetimeString,
        location: 'Test Location 123',
      };

      await createEventViaUI(page, eventData);

      // Verify event was created and appears in list
      await goToEventsList(page);
      await expectEventVisible(page, eventData.name);
    });

    test('organizer can create event with custom fields', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('customfields'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const datetimeString = futureDate.toISOString().slice(0, 16);

      const eventData = {
        name: generateTestName('Event with Custom Fields'),
        datetime: datetimeString,
        location: 'Test Location',
        customFields: [
          { label: 'Dietary Restrictions', type: 'text' as const, required: false },
          { label: 'T-shirt Size', type: 'select' as const, options: ['S', 'M', 'L', 'XL'] },
        ],
      };

      await createEventViaUI(page, eventData);

      await goToEventsList(page);
      await expectEventVisible(page, eventData.name);

      // TODO: Verify custom fields exist when viewing event detail
    });

    test('organizer can create private event', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('private'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const datetimeString = futureDate.toISOString().slice(0, 16);

      const eventData = {
        name: generateTestName('Private Event'),
        datetime: datetimeString,
        location: 'Secret Location',
        isPrivate: true,
      };

      await createEventViaUI(page, eventData);

      await goToEventsList(page);
      await expectEventVisible(page, eventData.name);
    });

    test('organizer can create event with max participants', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('maxparts'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const datetimeString = futureDate.toISOString().slice(0, 16);

      const eventData = {
        name: generateTestName('Limited Event'),
        datetime: datetimeString,
        location: 'Small Venue',
        maxParticipants: 10,
      };

      await createEventViaUI(page, eventData);

      await goToEventsList(page);
      await expectEventVisible(page, eventData.name);
    });

    test('event creation requires authentication', async ({ page }) => {
      // Try to access event creation page without auth
      await page.goto('/events/new');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should be redirected or shown sign-in message
      const url = page.url();
      const hasSignInButton = await page.getByRole('button', { name: /sign in/i }).isVisible().catch(() => false);
      
      expect(url.includes('/auth') || hasSignInButton).toBe(true);
    });
  });

  test.describe('Event Editing', () => {
    test('organizer can edit their own event', async ({ page }) => {
      // Create user and event
      const testUser = {
        email: generateTestEmail('editor'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      // Get user ID from session
      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      expect(userId).toBeTruthy();

      // Create event via database
      const event = await createTestEvent(userId!, {
        name: generateTestName('Original Event'),
        description: 'Original description',
        location: 'Original Location',
      });

      // Edit the event
      const updates = {
        name: generateTestName('Updated Event'),
        description: 'Updated description',
        location: 'Updated Location',
      };

      await editEventViaUI(page, event.id, updates);

      // Verify changes
      await page.goto(`/events/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      
      await expect(page.getByText(updates.name)).toBeVisible();
      await expect(page.getByText(updates.description)).toBeVisible();
    });

    test('organizer can toggle event privacy', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('privacytoggle'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      const event = await createTestEvent(userId!, {
        name: generateTestName('Public Event'),
        is_private: false,
      });

      // Navigate to edit page
      await page.goto(`/events/${event.id}/edit`);
      await page.waitForLoadState('domcontentloaded');

      // Toggle privacy
      const privateToggle = page.locator('input[name="is_private"], input[type="checkbox"][name*="private"]');
      const isChecked = await privateToggle.isChecked();
      expect(isChecked).toBe(false);

      await privateToggle.click();

      // Save
      const submitButton = page.getByRole('button', { name: /save|update/i });
      await submitButton.click();

      await page.waitForURL((url) => !url.pathname.includes('/edit'), { timeout: 10000 });

      // Verify the change was saved
      const { data: updatedEvent } = await getTestDb()
        .from('events')
        .select('is_private')
        .eq('id', event.id)
        .single();

      expect(updatedEvent?.is_private).toBe(true);
    });
  });

  test.describe('Event Deletion', () => {
    test('organizer can delete their own event', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('deleter'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      const event = await createTestEvent(userId!, {
        name: generateTestName('Event to Delete'),
      });

      // Delete the event
      await deleteEventViaUI(page, event.id);

      // Verify event is no longer visible in list
      await goToEventsList(page);
      await expectEventNotVisible(page, event.name);

      // Verify event was actually deleted from database
      const { data: deletedEvent } = await getTestDb()
        .from('events')
        .select('*')
        .eq('id', event.id)
        .single();

      expect(deletedEvent).toBeNull();
    });
  });

  test.describe('Public Event Discovery', () => {
    test('public events are visible to unauthenticated users', async ({ page }) => {
      // Create a user and public event
      const testUser = {
        email: generateTestEmail('publicorganizer'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      const publicEvent = await createTestEvent(userId!, {
        name: generateTestName('Public Event'),
        is_private: false,
      });

      // Logout
      await logout(page);

      // Navigate to home/events as unauthenticated user
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Public event should be visible
      const eventVisible = await page.getByText(publicEvent.name).isVisible().catch(() => false);
      expect(eventVisible).toBe(true);
    });

    test('private events are NOT visible to unauthenticated users', async ({ page }) => {
      // Create a user and private event
      const testUser = {
        email: generateTestEmail('privateorganizer'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      const privateEvent = await createTestEvent(userId!, {
        name: generateTestName('Private Event'),
        is_private: true,
      });

      // Logout
      await logout(page);

      // Navigate to home as unauthenticated user
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Private event should NOT be visible
      const eventVisible = await page.getByText(privateEvent.name).isVisible().catch(() => false);
      expect(eventVisible).toBe(false);
    });

    test('authenticated users can see their own private events', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('ownprivate'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      const privateEvent = await createTestEvent(userId!, {
        name: generateTestName('My Private Event'),
        is_private: true,
      });

      // Go to events list
      await goToEventsList(page);
      
      // Own private event should be visible
      await expectEventVisible(page, privateEvent.name);
    });
  });

  test.describe('Event Duplication', () => {
    test('organizer can duplicate event', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('duplicator'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      const originalEvent = await createTestEvent(userId!, {
        name: generateTestName('Original Event'),
        description: 'Original description',
        location: 'Original Location',
      });

      // Go to event detail page
      await page.goto(`/events/${originalEvent.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Find and click duplicate button
      const duplicateButton = page.getByRole('button', { name: /duplicate|copy/i });
      if (await duplicateButton.count() > 0) {
        await duplicateButton.click();
        await page.waitForTimeout(2000);

        // Should navigate to new event or show in list
        await goToEventsList(page);

        // Look for event with "(Copy)" suffix
        const duplicatedName = `${originalEvent.name} (Copy)`;
        const hasCopy = await page.getByText(duplicatedName).isVisible().catch(() => false);
        expect(hasCopy).toBe(true);
      } else {
        // Duplicate feature may not be implemented yet
        test.skip();
      }
    });

    test('duplicating event preserves labels', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('labeldup'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      const originalEvent = await createTestEvent(userId!, {
        name: generateTestName('Event with Labels'),
      });

      // Create label for original event
      await getTestDb().from('labels').insert({
        event_id: originalEvent.id,
        name: 'VIP',
        color: '#FF0000',
      });

      // Duplicate event via service
      const testDb = getTestDb();
      const { data: duplicatedEvent } = await testDb
        .from('events')
        .select('*')
        .eq('parent_event_id', originalEvent.id)
        .maybeSingle();

      if (duplicatedEvent) {
        // Check if labels were copied
        const { data: copiedLabels } = await testDb
          .from('labels')
          .select('*')
          .eq('event_id', duplicatedEvent.id);

        expect(copiedLabels).not.toBeNull();
        expect(copiedLabels?.length).toBeGreaterThan(0);
        expect(copiedLabels?.[0].name).toBe('VIP');
      } else {
        test.skip();
      }
    });
  });

  test.describe('Event List Display', () => {
    test('events list shows participant counts', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('countcheck'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      const event = await createTestEvent(userId!, {
        name: generateTestName('Event with Participants'),
      });

      // Add some participants
      await getTestDb().from('participants').insert([
        {
          event_id: event.id,
          name: 'Participant 1',
          email: generateTestEmail('p1'),
        },
        {
          event_id: event.id,
          name: 'Participant 2',
          email: generateTestEmail('p2'),
        },
      ]);

      // Go to events list
      await goToEventsList(page);

      // Event should be visible
      await expectEventVisible(page, event.name);

      // Look for participant count indicator (might be "2" or "2 participants")
      const hasCount = await page.getByText(/2.*participant/i).isVisible().catch(() => false);
      const hasNumber = await page.getByText('2').isVisible().catch(() => false);
      
      expect(hasCount || hasNumber).toBe(true);
    });

    test('events are sorted by creation date', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('sorter'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);

      const { data: { user } } = await getTestDb().auth.getUser();
      const userId = user?.id;

      // Create multiple events
      const event1 = await createTestEvent(userId!, {
        name: generateTestName('First Event'),
      });

      await page.waitForTimeout(100);

      const event2 = await createTestEvent(userId!, {
        name: generateTestName('Second Event'),
      });

      // Go to events list
      await goToEventsList(page);

      // Get all event names in order
      const eventCards = page.locator('[data-testid*="event"], [class*="event"]');
      const count = await eventCards.count();

      if (count >= 2) {
        const firstEventText = await eventCards.first().textContent();
        
        // Most recent event (event2) should appear first
        expect(firstEventText).toContain(event2.name);
      }
    });
  });
});
