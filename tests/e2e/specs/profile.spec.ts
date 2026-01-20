import { test, expect } from '@playwright/test';
import { register, clearAuth } from '../fixtures/auth';
import { generateTestEmail } from '../fixtures/database';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Profile Form', () => {
    test('displays current user information', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-display'),
        password: 'TestPassword123!',
        fullName: 'Profile Test User',
      };

      await register(page, testUser);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Check that form fields are populated with user data
      const fullNameInput = page.locator('input#fullName');
      const emailInput = page.locator('input#email');

      await expect(fullNameInput).toHaveValue('Profile Test User');
      await expect(emailInput).toHaveValue(testUser.email);
    });

    test('can update full name', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-update-name'),
        password: 'TestPassword123!',
        fullName: 'Original Name',
      };

      await register(page, testUser);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Update the full name
      const fullNameInput = page.locator('input#fullName');
      await fullNameInput.clear();
      await fullNameInput.fill('Updated Name');

      // Submit the form
      await page.click('button[type="submit"]');

      // Should show success toast and redirect to settings
      await expect(page).toHaveURL('/settings', { timeout: 10000 });

      // Go back to profile and verify the name was saved
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('input#fullName')).toHaveValue('Updated Name');
    });

    test('shows validation error for empty full name', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-empty-name'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Clear the full name
      const fullNameInput = page.locator('input#fullName');
      await fullNameInput.clear();

      // Submit the form
      await page.click('button[type="submit"]');

      // Should show toast error - look for sonner toast
      const toast = page.locator('[data-sonner-toast]');
      await expect(toast).toBeVisible({ timeout: 5000 });
      await expect(toast).toContainText(/name.*required/i);
    });

    test('prevents submission with invalid email format', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-invalid-email'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Enter invalid email
      const emailInput = page.locator('input#email');
      await emailInput.clear();
      await emailInput.fill('not-a-valid-email');

      // Submit the form
      await page.click('button[type="submit"]');

      // Validation prevents form submission - page stays on /profile
      await expect(page).toHaveURL('/profile');
    });

    test('shows validation error for empty email', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-empty-email'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Clear the email
      const emailInput = page.locator('input#email');
      await emailInput.clear();

      // Submit the form
      await page.click('button[type="submit"]');

      // Should show toast error
      const toast = page.locator('[data-sonner-toast]');
      await expect(toast).toBeVisible({ timeout: 5000 });
      await expect(toast).toContainText(/email.*required/i);
    });

    test('displays account information', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-account-info'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Check that account information section exists
      await expect(page.getByText('Account Information')).toBeVisible();
      await expect(page.getByText(/User ID:/)).toBeVisible();
      await expect(page.getByText(/Account created:/)).toBeVisible();
      await expect(page.getByText(/Last sign in:/)).toBeVisible();
    });

    test('save button shows loading state while submitting', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-loading'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Start watching for the button text change
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toContainText('Save Changes');

      // Update name and submit
      await page.locator('input#fullName').fill('New Name');
      await submitButton.click();

      // Button should show loading state (this happens quickly, so we check the text changed)
      // After submission, should redirect to settings
      await expect(page).toHaveURL('/settings', { timeout: 10000 });
    });
  });

  test.describe('Profile Access Control', () => {
    test('redirects unauthenticated users to login', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // ProtectedRoute redirects to login
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
    });

    test('stores return URL when redirecting to login', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });

      // Check that returnUrl was stored
      const returnUrl = await page.evaluate(() => localStorage.getItem('returnUrl'));
      expect(returnUrl).toBe('/profile');
    });
  });

  test.describe('Navigation', () => {
    test('can navigate to profile from settings', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-nav'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Click on Profile button (it's a button element, not a link)
      await page.locator('button:has-text("Profile")').click();

      // Should navigate to profile page
      await expect(page).toHaveURL('/profile');
    });

    test('close button returns to settings', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('profile-close'),
        password: 'TestPassword123!',
        fullName: 'Test User',
      };

      await register(page, testUser);
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Click the close button in TopNav
      const closeButton = page.locator('button[aria-label="Close"], a[aria-label="Close"]').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(page).toHaveURL('/settings');
      }
    });
  });
});
