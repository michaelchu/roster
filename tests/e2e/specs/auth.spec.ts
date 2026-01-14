import { test, expect } from '@playwright/test';
import { login, register, logout, clearAuth, isAuthenticated } from '../fixtures/auth';
import { generateTestEmail } from '../fixtures/database';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await clearAuth(page);
  });

  test.describe('User Registration', () => {
    test('new user can register successfully', async ({ page }) => {
      const testUser = {
        email: generateTestEmail('newuser'),
        password: 'TestPassword123!',
      };

      await register(page, testUser);

      // Should redirect after registration (either to / or /events depending on feature flag)
      await expect(page).toHaveURL(/\/(events)?$/);
      
      // Should be authenticated
      const authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);
    });

    test('registration fails with invalid email', async ({ page }) => {
      await page.goto('/auth/register');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input[type="email"]', 'invalid-email');
      await page.fill('input[type="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Should show validation error (HTML5 validation will prevent submission)
      // Or check for custom error message
      await expect(page).toHaveURL(/\/auth\/register/);
    });

    test('registration fails with weak password', async ({ page }) => {
      await page.goto('/auth/register');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input[type="email"]', generateTestEmail('weakpass'));
      await page.fill('input[type="password"]', '123'); // Too short
      await page.click('button[type="submit"]');

      // Should show error about password requirements
      await page.waitForTimeout(2000); // Wait for API response
      
      // Error should be visible (look for error message with red styling)
      const errorElement = page.locator('.text-red-700, [class*="text-red"]');
      await expect(errorElement).toBeVisible({ timeout: 5000 });
    });

    test('registration fails with duplicate email', async ({ page }) => {
      const email = generateTestEmail('duplicate');
      const password = 'TestPassword123!';

      // Register first time
      await register(page, { email, password });
      await logout(page);

      // Try to register again with same email
      await page.goto('/auth/register');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');

      // Should show error about existing account
      await page.waitForTimeout(2000);
      const errorElement = page.locator('.text-red-700, [class*="text-red"]');
      await expect(errorElement).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('User Login', () => {
    test('existing user can login successfully', async ({ page }) => {
      // First create a user
      const testUser = {
        email: generateTestEmail('logintest'),
        password: 'TestPassword123!',
      };
      
      await register(page, testUser);
      await logout(page);

      // Now login
      await login(page, testUser);

      // Should be on home page and authenticated
      const authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);
    });

    test('login fails with wrong password', async ({ page }) => {
      // Create user first
      const testUser = {
        email: generateTestEmail('wrongpass'),
        password: 'CorrectPassword123!',
      };
      
      await register(page, testUser);
      await logout(page);

      // Try to login with wrong password
      await page.goto('/auth/login');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', 'WrongPassword123!');
      await page.click('button[type="submit"]');

      // Should show error
      await page.waitForTimeout(2000);
      const errorVisible = await page.locator('[class*="red"], [class*="error"]').isVisible();
      expect(errorVisible).toBe(true);
    });

    test('login fails with non-existent user', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input[type="email"]', generateTestEmail('nonexistent'));
      await page.fill('input[type="password"]', 'SomePassword123!');
      await page.click('button[type="submit"]');

      // Should show error
      await page.waitForTimeout(2000);
      const errorVisible = await page.locator('[class*="red"], [class*="error"]').isVisible();
      expect(errorVisible).toBe(true);
    });

    test('login redirects to returnUrl after success', async ({ page }) => {
      // Create user
      const testUser = {
        email: generateTestEmail('returnurl'),
        password: 'TestPassword123!',
      };
      
      await register(page, testUser);
      await logout(page);

      // Navigate to login with returnUrl
      await page.goto('/auth/login?returnUrl=%2Fevents');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');

      // Should redirect to /events
      await expect(page).toHaveURL('/events');
    });

    test('login blocks malicious returnUrl redirects', async ({ page }) => {
      // Create user
      const testUser = {
        email: generateTestEmail('security'),
        password: 'TestPassword123!',
      };
      
      await register(page, testUser);
      await logout(page);

      // Try malicious returnUrl
      await page.goto('/auth/login?returnUrl=//evil.com/phishing');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');

      // Should redirect to safe page (home), NOT evil.com
      await page.waitForTimeout(2000);
      expect(page.url()).not.toContain('evil.com');
      expect(page.url()).toMatch(/localhost|127\.0\.0\.1/);
    });
  });

  test.describe('User Logout', () => {
    test('user can logout successfully', async ({ page }) => {
      // Create and login user
      const testUser = {
        email: generateTestEmail('logout'),
        password: 'TestPassword123!',
      };
      
      await register(page, testUser);
      
      // Verify logged in
      let authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);

      // Logout
      await logout(page);

      // Verify logged out
      authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(false);
    });

    test('logout clears session and requires re-login', async ({ page }) => {
      // Create and login user
      const testUser = {
        email: generateTestEmail('session'),
        password: 'TestPassword123!',
      };
      
      await register(page, testUser);
      await logout(page);

      // Try to access protected page
      await page.goto('/events');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Should show "Sign In Required" message and sign in button
      await expect(page.getByText(/sign in required/i)).toBeVisible();
      const signInButton = page.getByRole('button', { name: /sign in/i });
      await expect(signInButton).toBeVisible();
    });
  });

  test.describe('Session Persistence', () => {
    test('session persists across page reloads', async ({ page }) => {
      // Create and login user
      const testUser = {
        email: generateTestEmail('persist'),
        password: 'TestPassword123!',
      };
      
      await register(page, testUser);

      // Verify authenticated
      let authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);

      // Reload page
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Should still be authenticated
      authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);
    });

    test('session persists across navigation', async ({ page }) => {
      // Create and login user
      const testUser = {
        email: generateTestEmail('navigate'),
        password: 'TestPassword123!',
      };
      
      await register(page, testUser);

      // Navigate to different pages
      await page.goto('/events');
      await page.waitForLoadState('domcontentloaded');
      let authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);

      await page.goto('/groups');
      await page.waitForLoadState('domcontentloaded');
      authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);

      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');
      authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);
    });
  });
});
