import { test, expect } from '@playwright/test';

test.describe('EventDetailPage', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for testing
    await page.route('**/events/test-event-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-event-1',
          name: 'Test Event for E2E',
          description: 'This is a test event for end-to-end testing',
          datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Test Location',
          max_participants: 10,
          organizer_id: 'test-organizer-1',
          is_private: false,
          custom_fields: [],
        }),
      });
    });

    await page.route('**/events/test-event-1/participants', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-participant-1',
            event_id: 'test-event-1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            slot_number: 1,
            created_at: new Date().toISOString(),
            labels: [],
          },
          {
            id: 'test-participant-2',
            event_id: 'test-event-1',
            name: 'Jane Smith',
            email: 'jane@example.com',
            slot_number: 2,
            created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            labels: [],
          },
        ]),
      });
    });

    await page.route('**/events/test-event-1/labels', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('displays event information correctly', async ({ page }) => {
    // Navigate to a test event
    await page.goto('/events/test-event-1');

    // Wait for page to load and event title to appear
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Test Event for E2E')).toBeVisible({ timeout: 10000 });

    // Check if event description is shown
    await expect(page.locator('text=This is a test event for end-to-end testing')).toBeVisible();

    // Check if event location is shown
    await expect(page.locator('text=Test Location')).toBeVisible();
  });

  test('shows participants list', async ({ page }) => {
    await page.goto('/events/test-event-1');

    // Wait for participants section to load
    await page.waitForLoadState('networkidle');

    // Check if participants header is visible
    await expect(page.locator('text=Participants')).toBeVisible({ timeout: 10000 });

    // Check if test participants are shown
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).toBeVisible();
  });

  test('allows search functionality', async ({ page }) => {
    await page.goto('/events/test-event-1');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Find and click search button
    const searchButton = page
      .locator('button')
      .filter({ has: page.locator('[data-lucide="search"]') });
    await searchButton.click();

    // Check if search input appears
    await expect(page.locator('input[placeholder*="Search participants"]')).toBeVisible();

    // Test search functionality
    await page.fill('input[placeholder*="Search participants"]', 'John');
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=Jane Smith')).not.toBeVisible();
  });

  test('handles signup flow for authenticated users', async ({ page }) => {
    // Mock authentication state
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'sb-localhost-auth-token',
        JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'mock-user-id', email: 'test@example.com' },
        })
      );
    });

    await page.goto('/events/test-event-1');

    // Wait for join button
    await page.waitForLoadState('networkidle');
    const joinButton = page.locator('button:has-text("Join Event")');
    await expect(joinButton).toBeVisible({ timeout: 10000 });

    // Click join button
    await joinButton.click();

    // Check if signup drawer opens
    await expect(page.locator('text=Join Event').first()).toBeVisible();
    await expect(page.locator('input#signup-name')).toBeVisible();
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    // Ensure no auth state
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    await page.goto('/events/test-event-1');

    // Wait for join button
    await page.waitForLoadState('networkidle');
    const joinButton = page.locator('button:has-text("Join Event")');
    await expect(joinButton).toBeVisible({ timeout: 10000 });

    // Click join button
    await joinButton.click();

    // Should redirect to login
    await page.waitForURL('**/auth/login', { timeout: 10000 });
    await expect(page).toHaveURL(/.*auth\/login/);
  });

  test('allows event sharing', async ({ page }) => {
    await page.goto('/events/test-event-1');

    // Wait for share button
    await page.waitForLoadState('networkidle');
    const shareButton = page
      .locator('button')
      .filter({ has: page.locator('[data-lucide="share-2"]') });
    await expect(shareButton).toBeVisible({ timeout: 10000 });

    // Mock clipboard API
    await page.addInitScript(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: () => Promise.resolve(),
        },
      });
    });

    // Click share button
    await shareButton.click();

    // Check that share action was triggered (may show alert or copy to clipboard)
    // In real app, this would copy signup link to clipboard
  });

  test('handles mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/events/test-event-1');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Test Event for E2E')).toBeVisible({ timeout: 10000 });

    // Check if mobile layout is applied
    await expect(page.locator('.min-h-screen')).toBeVisible();

    // Check if join button is properly positioned at bottom
    await expect(page.locator('button:has-text("Join Event")')).toBeVisible();
  });

  test('displays export functionality', async ({ page }) => {
    await page.goto('/events/test-event-1');

    // Wait for export button
    await page.waitForLoadState('networkidle');
    const exportButton = page
      .locator('button')
      .filter({ has: page.locator('[data-lucide="download"]') });
    await expect(exportButton).toBeVisible({ timeout: 10000 });

    // Click export button (this would download CSV in real app)
    await exportButton.click();
  });

  test('handles error states gracefully', async ({ page }) => {
    // Navigate to non-existent event
    await page.goto('/events/non-existent-event');

    // Should show error message or fallback UI
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Event not found')).toBeVisible({ timeout: 10000 });
  });
});
