import { Page } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  fullName?: string;
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
 * Returns the user ID from the session
 */
export async function register(page: Page, user: TestUser): Promise<string | null> {
  await page.goto('/auth/register');
  await page.waitForLoadState('domcontentloaded');

  await page.waitForSelector('input[type="email"]', { state: 'visible' });

  // Fill in full name (required field)
  await page.fill('input[id="fullName"]', user.fullName || 'Test User');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation after successful registration
  await page.waitForURL((url) => !url.pathname.includes('/auth/register'), {
    timeout: 10000,
  });

  // Extract user ID from Supabase session in localStorage
  const userId = await page.evaluate(() => {
    try {
      // Supabase stores auth session in localStorage with key like 'sb-{project-ref}-auth-token'
      const keys = Object.keys(localStorage).filter(key => key.includes('auth-token'));
      if (keys.length > 0) {
        const sessionData = localStorage.getItem(keys[0]);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          return session?.user?.id || null;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  return userId;
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
  // First check if there's a valid session in localStorage
  const userId = await getUserId(page);
  if (!userId) {
    return false;
  }

  // Navigate to home and wait for authenticated UI
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Check for authenticated UI elements - bottom navigation should exist for logged in users
  // Wait longer for the UI to render based on auth state
  const bottomNav = page.locator('nav[role="navigation"][aria-label="Main navigation"]');
  try {
    await bottomNav.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current user ID from browser session
 * Returns null if not authenticated
 */
export async function getUserId(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    try {
      const keys = Object.keys(localStorage).filter(key => key.includes('auth-token'));
      if (keys.length > 0) {
        const sessionData = localStorage.getItem(keys[0]);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          return session?.user?.id || null;
        }
      }
      return null;
    } catch {
      return null;
    }
  });
}

/**
 * Clear all auth state and storage
 */
export async function clearAuth(page: Page) {
  // Navigate to a valid origin first to enable storage access
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
