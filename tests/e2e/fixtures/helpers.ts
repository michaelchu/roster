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
  await page.waitForTimeout(1500);

  // Fill participant details - use IDs which are more specific
  // Name is required, so fill it even if not provided
  const nameInput = page.locator('#signup-name');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  const nameToFill = participantData.name || `Test User ${Date.now()}`;
  await nameInput.fill(nameToFill);

  if (participantData.email) {
    const emailInput = page.locator('#signup-email');
    if (await emailInput.count() > 0) {
      await emailInput.fill(participantData.email);
    }
  }

  if (participantData.phone) {
    const phoneInput = page.locator('#signup-phone');
    if (await phoneInput.count() > 0) {
      await phoneInput.fill(participantData.phone);
    }
  }

  if (participantData.notes) {
    // Notes are in a different tab, need to click Notes tab first
    const notesTab = page.getByRole('tab', { name: /notes/i });
    if (await notesTab.count() > 0) {
      await notesTab.click();
      await page.waitForTimeout(500);
      const notesInput = page.locator('#signup-notes');
      await notesInput.fill(participantData.notes);
      // Switch back to registration tab
      await page.getByRole('tab', { name: /registration/i }).click();
      await page.waitForTimeout(500);
    }
  }

  // Handle custom field responses - fields have IDs like #signup-{field.id}
  if (participantData.customFieldResponses) {
    for (const [fieldId, value] of Object.entries(participantData.customFieldResponses)) {
      const fieldInput = page.locator(`#signup-${fieldId}`);
      if (await fieldInput.count() > 0) {
        const inputType = await fieldInput.getAttribute('type');
        
        if (inputType === 'select' || (await fieldInput.evaluate(el => el.tagName)) === 'SELECT') {
          // For select dropdowns (might be shadcn Select component)
          // Try to find the select trigger and click it
          const selectTrigger = page.locator(`[id="signup-${fieldId}"]`).locator('..');
          if (await selectTrigger.count() > 0) {
            // This might be a shadcn Select - skip for now as it's complex
            // Tests can create participants via database for custom fields
          }
        } else if (Array.isArray(value)) {
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
  // Reload the page to ensure the UI reflects the user's registration
  await page.goto(`/signup/${eventId}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle'); // Wait for all network requests
  await page.waitForTimeout(3000); // Give time for participant list to load and render

  // Look for "Claim" button in empty slot (small button next to "Available slot")
  // The button only appears when: user is registered, event has max_participants, and there are empty slots
  const claimButton = page.locator('button:has-text("Claim")').first(); // Use first one in the slot
  await claimButton.waitFor({ state: 'visible', timeout: 10000 });
  await claimButton.click();

  await page.waitForTimeout(1500);

  // Fill guest details if provided - name is optional for claims
  if (guestData.name) {
    const nameInput = page.locator('#signup-name');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(guestData.name);
  }

  // Submit the form - try pressing Enter in the name field first (more reliable for forms)
  await page.waitForTimeout(500); // Let drawer fully render
  
  const nameInput = page.locator('#signup-name');
  if (await nameInput.isVisible()) {
    await nameInput.press('Enter');
    await page.waitForTimeout(2000);
  }
  
  // If Enter didn't work, try clicking the submit button
  const drawerCheck1 = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  if (drawerCheck1) {
    // Drawer still open, try button click
    const submitButton = page.getByRole('button', { name: 'Claim' }).last();
    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
      await page.waitForTimeout(3000);
    }
  }
  
  // Final wait for submission
  await page.waitForTimeout(3000);
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
  await page.waitForTimeout(500); // Wait for auth check and form load

  const name = groupData.name || generateTestName('Group');
  await page.fill('#name', name);

  if (groupData.description) {
    await page.fill('#description', groupData.description);
  }

  if (groupData.isPrivate !== undefined) {
    // Privacy toggle is a button, not a checkbox
    const privateButton = page.locator('button:has-text("Private Group"), button:has-text("Public Group")');
    await privateButton.waitFor({ state: 'visible', timeout: 5000 });
    const buttonText = await privateButton.textContent();
    const isCurrentlyPrivate = buttonText?.includes('Private');
    
    if (isCurrentlyPrivate !== groupData.isPrivate) {
      await privateButton.click();
    }
  }

  // Submit - button text is "Create Group"
  const submitButton = page.getByRole('button', { name: /create group/i });
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
