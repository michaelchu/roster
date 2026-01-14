import { Page, expect } from '@playwright/test';
import { generateTestEmail, generateTestName } from './database';

/**
 * Event creation helpers
 */

export interface EventFormData {
  name: string;
  description?: string;
  datetime: string;
  endDatetime?: string;
  location?: string;
  isPrivate?: boolean;
  maxParticipants?: number;
  customFields?: Array<{
    label: string;
    type: 'text' | 'select' | 'checkbox';
    required?: boolean;
    options?: string[];
  }>;
}

/**
 * Create an event via UI
 */
export async function createEventViaUI(page: Page, eventData: Partial<EventFormData> = {}) {
  await page.goto('/events/new');
  await page.waitForLoadState('domcontentloaded');

  // Fill basic fields
  const name = eventData.name || generateTestName('Event');
  await page.fill('input[name="name"]', name);

  if (eventData.description) {
    await page.fill('textarea[name="description"]', eventData.description);
  }

  // Date/time - look for datetime input
  if (eventData.datetime) {
    const datetimeInput = page.locator('input[name="datetime"], input[type="datetime-local"]');
    await datetimeInput.fill(eventData.datetime);
  }

  if (eventData.endDatetime) {
    const endDatetimeInput = page.locator(
      'input[name="endDatetime"], input[name="end_datetime"]'
    );
    if (await endDatetimeInput.count() > 0) {
      await endDatetimeInput.fill(eventData.endDatetime);
    }
  }

  if (eventData.location) {
    await page.fill('input[name="location"]', eventData.location);
  }

  // Privacy toggle
  if (eventData.isPrivate !== undefined) {
    const privateToggle = page.locator('input[name="is_private"], input[type="checkbox"][name*="private"]');
    const isChecked = await privateToggle.isChecked();
    if (isChecked !== eventData.isPrivate) {
      await privateToggle.click();
    }
  }

  // Max participants
  if (eventData.maxParticipants) {
    const maxInput = page.locator('input[name="max_participants"], input[name="maxParticipants"]');
    if (await maxInput.count() > 0) {
      await maxInput.fill(String(eventData.maxParticipants));
    }
  }

  // Custom fields (if supported in UI)
  if (eventData.customFields && eventData.customFields.length > 0) {
    for (const field of eventData.customFields) {
      // Click "Add Custom Field" button
      const addFieldButton = page.getByRole('button', { name: /add.*field/i });
      if (await addFieldButton.count() > 0) {
        await addFieldButton.click();
        await page.waitForTimeout(300);

        // Fill custom field details
        const fieldInputs = page.locator('[data-testid*="custom-field"], [class*="custom-field"]').last();
        await fieldInputs.locator('input[name*="label"]').fill(field.label);
        
        // Select field type if dropdown exists
        const typeSelect = fieldInputs.locator('select[name*="type"]');
        if (await typeSelect.count() > 0) {
          await typeSelect.selectOption(field.type);
        }
      }
    }
  }

  // Submit form
  const submitButton = page.getByRole('button', { name: /create|save/i });
  await submitButton.click();

  // Wait for navigation to event detail or events list
  await page.waitForURL((url) => url.pathname !== '/events/new', { timeout: 10000 });

  return { name };
}

/**
 * Edit an existing event
 */
export async function editEventViaUI(
  page: Page,
  eventId: string,
  updates: Partial<EventFormData>
) {
  await page.goto(`/events/${eventId}/edit`);
  await page.waitForLoadState('domcontentloaded');

  if (updates.name) {
    await page.fill('input[name="name"]', updates.name);
  }

  if (updates.description !== undefined) {
    await page.fill('textarea[name="description"]', updates.description);
  }

  if (updates.location) {
    await page.fill('input[name="location"]', updates.location);
  }

  // Submit
  const submitButton = page.getByRole('button', { name: /save|update/i });
  await submitButton.click();

  await page.waitForURL((url) => !url.pathname.includes('/edit'), { timeout: 10000 });
}

/**
 * Delete an event via UI
 */
export async function deleteEventViaUI(page: Page, eventId: string) {
  await page.goto(`/events/${eventId}`);
  await page.waitForLoadState('domcontentloaded');

  // Find and click delete button
  const deleteButton = page.getByRole('button', { name: /delete/i });
  await deleteButton.click();

  // Confirm deletion in dialog
  const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
  await confirmButton.click();

  await page.waitForURL((url) => url.pathname !== `/events/${eventId}`, { timeout: 5000 });
}

/**
 * Participant registration helpers
 */

export interface ParticipantFormData {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  customFieldResponses?: Record<string, string | string[]>;
}

/**
 * Register for an event as an authenticated user
 */
export async function registerForEvent(
  page: Page,
  eventId: string,
  participantData: ParticipantFormData = {}
) {
  await page.goto(`/events/${eventId}`);
  await page.waitForLoadState('domcontentloaded');

  // Click register/signup button
  const registerButton = page.getByRole('button', { name: /register|sign up|join/i });
  await registerButton.click();

  // Wait for form to appear (might be modal or new page)
  await page.waitForTimeout(500);

  // Fill participant details
  if (participantData.name) {
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.count() > 0) {
      await nameInput.fill(participantData.name);
    }
  }

  if (participantData.email) {
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.count() > 0) {
      await emailInput.fill(participantData.email);
    }
  }

  if (participantData.phone) {
    const phoneInput = page.locator('input[name="phone"]');
    if (await phoneInput.count() > 0) {
      await phoneInput.fill(participantData.phone);
    }
  }

  if (participantData.notes) {
    const notesInput = page.locator('textarea[name="notes"]');
    if (await notesInput.count() > 0) {
      await notesInput.fill(participantData.notes);
    }
  }

  // Handle custom field responses
  if (participantData.customFieldResponses) {
    for (const [fieldLabel, value] of Object.entries(participantData.customFieldResponses)) {
      // Try to find input by label
      const fieldInput = page.locator(`input[name*="${fieldLabel}"], textarea[name*="${fieldLabel}"]`);
      if (await fieldInput.count() > 0) {
        if (Array.isArray(value)) {
          // Checkbox or multi-select
          for (const v of value) {
            await page.check(`input[value="${v}"]`);
          }
        } else {
          await fieldInput.fill(value);
        }
      }
    }
  }

  // Submit registration
  const submitButton = page.getByRole('button', { name: /submit|register|confirm/i }).last();
  await submitButton.click();

  // Wait for success indication
  await page.waitForTimeout(2000);
}

/**
 * Claim an additional spot for an event
 */
export async function claimAdditionalSpot(
  page: Page,
  eventId: string,
  guestData: ParticipantFormData = {}
) {
  await page.goto(`/events/${eventId}`);
  await page.waitForLoadState('domcontentloaded');

  // Look for "Claim spot" or "Add guest" button
  const claimButton = page.getByRole('button', { name: /claim|add guest|add spot/i });
  await claimButton.click();

  await page.waitForTimeout(500);

  // Fill guest details
  if (guestData.name) {
    await page.fill('input[name="name"]', guestData.name);
  }

  // Submit
  const submitButton = page.getByRole('button', { name: /submit|claim|add/i }).last();
  await submitButton.click();

  await page.waitForTimeout(2000);
}

/**
 * Group management helpers
 */

export interface GroupFormData {
  name: string;
  description?: string;
  isPrivate?: boolean;
}

/**
 * Create a group via UI
 */
export async function createGroupViaUI(page: Page, groupData: Partial<GroupFormData> = {}) {
  await page.goto('/groups/new');
  await page.waitForLoadState('domcontentloaded');

  const name = groupData.name || generateTestName('Group');
  await page.fill('input[name="name"]', name);

  if (groupData.description) {
    await page.fill('textarea[name="description"]', groupData.description);
  }

  if (groupData.isPrivate !== undefined) {
    const privateToggle = page.locator('input[name="is_private"], input[type="checkbox"][name*="private"]');
    const isChecked = await privateToggle.isChecked();
    if (isChecked !== groupData.isPrivate) {
      await privateToggle.click();
    }
  }

  // Submit
  const submitButton = page.getByRole('button', { name: /create|save/i });
  await submitButton.click();

  await page.waitForURL((url) => url.pathname !== '/groups/new', { timeout: 10000 });

  return { name };
}

/**
 * Navigation helpers
 */

export async function goToEvent(page: Page, eventId: string) {
  await page.goto(`/events/${eventId}`);
  await page.waitForLoadState('domcontentloaded');
}

export async function goToGroup(page: Page, groupId: string) {
  await page.goto(`/groups/${groupId}`);
  await page.waitForLoadState('domcontentloaded');
}

export async function goToEventsList(page: Page) {
  await page.goto('/events');
  await page.waitForLoadState('domcontentloaded');
}

export async function goToGroupsList(page: Page) {
  await page.goto('/groups');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Assertion helpers
 */

export async function expectEventVisible(page: Page, eventName: string) {
  const eventCard = page.getByText(eventName);
  await expect(eventCard).toBeVisible({ timeout: 5000 });
}

export async function expectEventNotVisible(page: Page, eventName: string) {
  const eventCard = page.getByText(eventName);
  await expect(eventCard).not.toBeVisible({ timeout: 5000 });
}

export async function expectParticipantInList(page: Page, participantName: string) {
  const participant = page.getByText(participantName);
  await expect(participant).toBeVisible({ timeout: 5000 });
}

export async function expectGroupVisible(page: Page, groupName: string) {
  const groupCard = page.getByText(groupName);
  await expect(groupCard).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for async operations
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse((response) => {
    const url = response.url();
    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });
}
