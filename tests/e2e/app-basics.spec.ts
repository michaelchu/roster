import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Basic App Functionality', () => {
  test('homepage loads without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded
    await expect(page).toHaveTitle(/Roster/);
    await expect(page.locator('#root')).toBeAttached();

    // Verify no console errors (critical errors)
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Give page a moment to throw any errors
    await page.waitForTimeout(1000);
    expect(errors.length).toBe(0);
  });

  test('mobile viewport renders correctly', async ({ page }) => {
    // Test specifically on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Roster/);
    await expect(page.locator('#root')).toBeVisible();
  });

  test('404 page handles non-existent routes', async ({ page }) => {
    await page.goto('/non-existent-route-12345');
    await page.waitForLoadState('domcontentloaded');

    // Should show 404 message
    await expect(page.getByText('Page not found')).toBeVisible();
    
    // Should have go back button
    await expect(page.getByRole('button', { name: /go back/i })).toBeVisible();
  });

  test('app handles network offline gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Simulate offline
    await page.context().setOffline(true);

    // App should still render (not crash)
    await expect(page.locator('#root')).toBeAttached();

    // Restore online
    await page.context().setOffline(false);
  });

  test('navigation between public pages works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to login page
    const signInButton = page.getByRole('button', { name: /sign in/i }).first();
    if (await signInButton.isVisible()) {
      await signInButton.click();
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    }
  });
});
