import { Page } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  id?: string;
}

/**
 * Login helper for E2E tests
 * Navigates to login page and submits credentials
 */
export async function login(page: Page, user: TestUser) {
  await page.goto('/auth/login');
  await page.waitForLoadState('domcontentloaded');

  // Wait for form to be visible
  await page.waitForSelector('input[type="email"]', { state: 'visible' });

  // Fill in credentials
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation after successful login
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 10000,
  });
}

/**
 * Register a new user account
 */
export async function register(page: Page, user: TestUser) {
  await page.goto('/auth/register');
  await page.waitForLoadState('domcontentloaded');

  await page.waitForSelector('input[type="email"]', { state: 'visible' });

  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation after successful registration
  await page.waitForURL((url) => !url.pathname.includes('/auth/register'), {
    timeout: 10000,
  });
}

/**
 * Logout current user
 */
export async function logout(page: Page) {
  await page.goto('/settings');
  await page.waitForLoadState('domcontentloaded');

  // Find and click sign out button
  const signOutButton = page.getByRole('button', { name: /sign out/i });
  await signOutButton.click();

  // Wait for redirect to home/login
  await page.waitForURL((url) => url.pathname === '/' || url.pathname.includes('/auth'), {
    timeout: 5000,
  });
}

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Check for authenticated UI elements (adjust based on your app)
  // Looking for bottom navigation or user-specific content
  const bottomNav = page.locator('nav').filter({ hasText: /Events|Groups/i });
  const isNavVisible = await bottomNav.isVisible().catch(() => false);

  return isNavVisible;
}

/**
 * Clear all auth state and storage
 */
export async function clearAuth(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
