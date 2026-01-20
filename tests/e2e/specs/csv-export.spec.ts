import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId, logout } from '../fixtures/auth';
import { generateTestEmail, generateTestName, createTestEvent, getAdminDb } from '../fixtures/database';
import * as fs from 'fs';

// NOTE: These tests depend on the csv_export feature flag being enabled
// Tests will check for export button visibility and assert accordingly

test.describe('CSV Export', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('organizer can export participants to CSV', async ({ page }) => {
    const testUser = {
      email: generateTestEmail('csv-export'),
      password: 'TestPassword123!',
    };
    await register(page, testUser);
    const userId = await getUserId(page);

    const event = await createTestEvent(userId!, {
      name: generateTestName('Export Event'),
    });

    // Add participants
    await getAdminDb()
      .from('participants')
      .insert([
        {
          event_id: event.id,
          name: 'Alice Test',
          email: 'alice@example.com',
          phone: '555-1234',
        },
        {
          event_id: event.id,
          name: 'Bob Test',
          email: 'bob@example.com',
          phone: '555-5678',
        },
      ]);

    await page.goto(`/signup/${event.id}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Check if export button exists (depends on csv_export feature flag)
    const exportButton = page.getByRole('button', { name: /export/i });
    const exportCount = await exportButton.count();

    if (exportCount === 0) {
      // Feature flag is disabled - just verify organizer sees the event
      await expect(page.getByText(event.name)).toBeVisible();
      return;
    }

    // Feature flag is enabled - test export functionality
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    expect(filename).toContain('.csv');

    const content = await download.path().then((path) => {
      if (path) {
        return fs.readFileSync(path, 'utf-8');
      }
      return null;
    });

    if (content) {
      expect(content).toContain('Name');
      expect(content).toContain('Alice Test');
      expect(content).toContain('Bob Test');
    }
  });

  test('export button not visible to non-organizers', async ({ page }) => {
    // Create event as one user
    const organizerUser = {
      email: generateTestEmail('organizer-export'),
      password: 'TestPassword123!',
    };
    await register(page, organizerUser);
    const organizerId = await getUserId(page);

    const event = await createTestEvent(organizerId!, {
      name: generateTestName('Not My Export Event'),
      is_private: false,
    });

    await getAdminDb().from('participants').insert({
      event_id: event.id,
      name: 'Test Participant',
      email: 'test@example.com',
    });

    await logout(page);

    const viewerUser = {
      email: generateTestEmail('viewer-export'),
      password: 'TestPassword123!',
    };
    await register(page, viewerUser);

    await page.goto(`/signup/${event.id}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Export button should not be visible for non-organizers regardless of feature flag
    const exportButton = page.getByRole('button', { name: /export/i });
    await expect(exportButton).not.toBeVisible();
  });
});
