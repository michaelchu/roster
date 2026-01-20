import { test, expect } from '@playwright/test';
import { register, logout, clearAuth } from '../fixtures/auth';
import { generateTestEmail } from '../fixtures/database';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Settings Display', () => {
    test('displays user information', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-display'),
        password: 'TestPassword123!',
        fullName: 'Settings Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Check user info is displayed
      await expect(page.getByText('Settings Test User')).toBeVisible();
      await expect(page.getByText(testUser.email)).toBeVisible();
    });

    test('displays all settings sections', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-sections'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Check that main sections are visible
      await expect(page.getByText('Event Management')).toBeVisible();
      await expect(page.getByText('Appearance')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
    });
  });

  test.describe('Event Management Settings', () => {
    test('can change default event capacity', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-capacity'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Find the capacity input
      const capacityInput = page.locator('input#max-participants-input');
      await expect(capacityInput).toBeVisible();

      // Clear and set new value
      await capacityInput.clear();
      await capacityInput.fill('25');
      await capacityInput.blur();

      // Reload page and verify persistence
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('input#max-participants-input')).toHaveValue('25');
    });

    test('can increment/decrement capacity with buttons', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-capacity-btns'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // First set a known value
      const capacityInput = page.locator('input#max-participants-input');
      await capacityInput.clear();
      await capacityInput.fill('10');
      await capacityInput.blur();

      // Click increment button
      const incrementButton = page.locator('button[aria-label*="Increase"]').first();
      await incrementButton.click();

      // Should now be 11
      await expect(capacityInput).toHaveValue('11');

      // Click decrement button
      const decrementButton = page.locator('button[aria-label*="Decrease"]').first();
      await decrementButton.click();

      // Should be back to 10
      await expect(capacityInput).toHaveValue('10');
    });

    test('can change default event visibility', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-visibility'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Find and click the visibility dropdown
      const visibilityTrigger = page.locator('#default-visibility');
      await visibilityTrigger.click();

      // Select Private option
      await page.getByRole('option', { name: 'Private' }).click();

      // Reload and verify persistence
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('#default-visibility')).toContainText('Private');
    });

    test('visibility options are available', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-visibility-opts'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Open visibility dropdown
      const visibilityTrigger = page.locator('#default-visibility');
      await visibilityTrigger.click();

      // Check all options are available
      await expect(page.getByRole('option', { name: 'Public' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Private' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Invite Only' })).toBeVisible();
    });
  });

  test.describe('Appearance Settings', () => {
    test('can change theme to dark', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-dark'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Find and click the theme dropdown
      const themeTrigger = page.locator('#theme');
      await themeTrigger.click();

      // Select Dark option
      await page.getByRole('option', { name: 'Dark' }).click();

      // Verify the page has dark theme class
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    });

    test('can change theme to light', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-light'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // First set to dark
      await page.locator('#theme').click();
      await page.getByRole('option', { name: 'Dark' }).click();

      // Then change to light
      await page.locator('#theme').click();
      await page.getByRole('option', { name: 'Light' }).click();

      // Verify the page has light theme (no dark class)
      const html = page.locator('html');
      await expect(html).not.toHaveClass(/dark/);
    });

    test('font size slider is functional', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-font'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Find the font size slider
      const slider = page.locator('#font-size');
      await expect(slider).toBeVisible();

      // The slider should be interactive
      const sliderThumb = slider.locator('[role="slider"]');
      await expect(sliderThumb).toBeVisible();
    });
  });

  test.describe('Profile Navigation', () => {
    test('can navigate to profile page', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-to-profile'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Click on Profile button (it's a button element)
      await page.locator('button:has-text("Profile")').click();

      // Should navigate to profile page
      await expect(page).toHaveURL('/profile');
    });
  });

  test.describe('Sign Out', () => {
    test('sign out button logs user out', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-signout'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Click sign out
      await page.getByRole('button', { name: /sign out/i }).click();

      // Should redirect to home/login
      await expect(page).toHaveURL(/\/(auth\/login)?$/, { timeout: 10000 });
    });

    test('after sign out, settings page redirects to login', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-signout-access'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await logout(page);

      // Try to access settings
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // ProtectedRoute redirects to login
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
    });
  });

  test.describe('Settings Persistence', () => {
    test('settings persist across page navigation', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-persist-nav'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Change capacity
      const capacityInput = page.locator('input#max-participants-input');
      await capacityInput.clear();
      await capacityInput.fill('50');
      await capacityInput.blur();

      // Change visibility
      await page.locator('#default-visibility').click();
      await page.getByRole('option', { name: 'Invite Only' }).click();

      // Navigate away
      await page.goto('/events');
      await page.waitForLoadState('domcontentloaded');

      // Navigate back
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Verify settings persisted
      await expect(page.locator('input#max-participants-input')).toHaveValue('50');
      await expect(page.locator('#default-visibility')).toContainText('Invite Only');
    });

    test('settings persist after logout and login', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('settings-persist-auth'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Change capacity to specific value
      const capacityInput = page.locator('input#max-participants-input');
      await capacityInput.clear();
      await capacityInput.fill('42');
      await capacityInput.blur();

      // Note: localStorage persists for same origin even after logout
      // This tests that localStorage-based settings survive auth changes
      await logout(page);

      // Login again
      await page.goto('/auth/login');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 10000 });

      // Check settings
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('input#max-participants-input')).toHaveValue('42');
    });
  });

  test.describe('Settings Access Control', () => {
    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // ProtectedRoute redirects to login
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
    });

    test('stores return URL when redirecting to login', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });

      // Check that returnUrl was stored
      const returnUrl = await page.evaluate(() => localStorage.getItem('returnUrl'));
      expect(returnUrl).toBe('/settings');
    });
  });
});
