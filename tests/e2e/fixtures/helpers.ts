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
  await page.waitForTimeout(500); // Wait for auth check to complete

  // Fill basic fields
  const name = eventData.name || generateTestName('Event');
  await page.fill('#name', name);

  if (eventData.description) {
    await page.fill('#description', eventData.description);
  }

  // Date/time - Skip for now as it's a complex DateTimeInput component with popover
  // The form doesn't require datetime to be filled, so we can skip it
  if (eventData.datetime) {
    // DateTimeInput is complex - skip for now
    // Tests can create events via database for more complex scenarios
  }

  if (eventData.location) {
    await page.fill('#location', eventData.location);
  }

  // Privacy toggle - it's a button, not a checkbox
  if (eventData.isPrivate !== undefined) {
    const privateButton = page.locator('button:has-text("Private Event"), button:has-text("Public Event")');
    const buttonText = await privateButton.textContent();
    const isCurrentlyPrivate = buttonText?.includes('Private');
    
    if (isCurrentlyPrivate !== eventData.isPrivate) {
      await privateButton.click();
    }
  }

  // Max participants
  if (eventData.maxParticipants) {
    const maxInput = page.locator('input[name="max_participants"], input[name="maxParticipants"]');
    if (await maxInput.count() > 0) {
      await maxInput.fill(String(eventData.maxParticipants));
    }
  }

  // Custom fields - Skip for now as the UI is complex
  // Tests that need custom fields should use database creation

  // Submit form
  const submitButton = page.getByRole('button', { name: /create/i });
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
  await page.waitForTimeout(500); // Wait for form to populate

  if (updates.name) {
    await page.fill('#name', updates.name);
  }

  if (updates.description !== undefined) {
    await page.fill('#description', updates.description);
  }

  if (updates.location) {
    await page.fill('#location', updates.location);
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
  // Go to edit page where delete button is located
  await page.goto(`/events/${eventId}/edit`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500); // Wait for page to load

  // Find and click delete button
  const deleteButton = page.getByRole('button', { name: /delete/i });
  await deleteButton.click();

  // Confirm deletion in dialog
  const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i }).last();
  await confirmButton.click();

  await page.waitForURL((url) => url.pathname !== `/events/${eventId}/edit`, { timeout: 5000 });
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
  await page.goto(`/signup/${eventId}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000); // Wait for page to fully render

  // Click the join/register button - the actual button text is "Join Event" or "Modify Registration"
  const registerButton = page.getByRole('button', { name: /join event|modify registration/i });
  
  // Wait for button to be visible and clickable
  await registerButton.waitFor({ state: 'visible', timeout: 10000 });
  await registerButton.click();

  // Wait for form/drawer to appear
  await page.waitForTimeout(1000);

  // Fill participant details if inputs are present
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

  // Submit registration - the submit button text is "Join Event", "Update", or "Claim"
  const submitButton = page.getByRole('button', { name: /join event|update|claim/i }).last();
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  await submitButton.click();

  // Wait for success indication and form submission to complete
  await page.waitForTimeout(3000);
  
  // Check if drawer closed (indicates successful submission)
  const drawerClosed = await page.locator('[role="dialog"]').count() === 0;
  if (!drawerClosed) {
    // If drawer still open, wait a bit more
    await page.waitForTimeout(2000);
  }
}

/**
 * Claim an additional spot for an event
 */
export async function claimAdditionalSpot(
  page: Page,
  eventId: string,
  guestData: ParticipantFormData = {}
) {
  await page.goto(`/signup/${eventId}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Look for "Claim" button in empty slot (small button next to "Available slot")
  const claimButton = page.getByRole('button', { name: /^claim$/i });
  await claimButton.waitFor({ state: 'visible', timeout: 10000 });
  await claimButton.click();

  await page.waitForTimeout(1000);

  // Fill guest details if provided
  if (guestData.name) {
    const nameInput = page.locator('#signup-name');
    if (await nameInput.count() > 0) {
      await nameInput.fill(guestData.name);
    }
  }

  // Submit - button text is "Claim" when claiming additional spot
  const submitButton = page.getByRole('button', { name: /^claim$/i }).last();
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
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
  await page.fill('#name', name);

  if (groupData.description) {
    await page.fill('#description', groupData.description);
  }

  if (groupData.isPrivate !== undefined) {
    // Privacy toggle is a button, not a checkbox
    const privateButton = page.locator('button:has-text("Private Group"), button:has-text("Public Group")');
    const buttonText = await privateButton.textContent();
    const isCurrentlyPrivate = buttonText?.includes('Private');
    
    if (isCurrentlyPrivate !== groupData.isPrivate) {
      await privateButton.click();
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
  await page.goto(`/signup/${eventId}`);
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
