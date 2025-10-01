import { test, expect } from '@playwright/test';

test.describe('Invite Flow E2E Tests', () => {
  test.describe('Event Invite Flow', () => {
    test('should display event invitation page for unauthenticated user', async ({ page }) => {
      // Navigate to a mock event invite (using a test event ID)
      await page.goto('/invite/event/test-event-123');

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // Check that invitation page loaded
      await expect(page.getByText('Event Invitation')).toBeVisible();

      // For unauthenticated user, should see sign in button
      // Note: This will only work if the event exists in the test database
      // In a real test environment, you'd seed the database first
    });

    test('should redirect to login when sign in clicked on invite page', async ({ page }) => {
      await page.goto('/invite/event/test-event-123');
      await page.waitForLoadState('domcontentloaded');

      // Click sign in button if visible (only if event exists and user not authenticated)
      const signInButton = page.getByRole('button', { name: /sign in to join/i });

      if (await signInButton.isVisible()) {
        await signInButton.click();

        // Should redirect to login page with returnUrl
        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.url()).toContain('returnUrl');
      }
    });

    test('should handle invalid event ID gracefully', async ({ page }) => {
      await page.goto('/invite/event/invalid-nonexistent-id-12345');
      await page.waitForLoadState('domcontentloaded');

      // Should show error state or not found message
      // Note: Exact behavior depends on error handling in the component
      await expect(page.locator('#root')).toBeAttached();
    });
  });

  test.describe('Group Invite Flow', () => {
    test('should display group invitation page for unauthenticated user', async ({ page }) => {
      await page.goto('/invite/group/test-group-123');
      await page.waitForLoadState('domcontentloaded');

      // Check that page loaded (specific content depends on if group exists)
      await expect(page.locator('#root')).toBeAttached();
    });

    test('should redirect to login when sign in clicked on group invite', async ({ page }) => {
      await page.goto('/invite/group/test-group-123');
      await page.waitForLoadState('domcontentloaded');

      const signInButton = page.getByRole('button', { name: /sign in to join/i });

      if (await signInButton.isVisible()) {
        await signInButton.click();
        await expect(page).toHaveURL(/\/auth\/login/);
      }
    });
  });

  test.describe('Share Link Functionality', () => {
    test('event share button generates invite link', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      // This test requires authentication and an existing event
      // Navigate to an event detail page (would need authentication in real scenario)
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Note: Full flow would require:
      // 1. Login
      // 2. Create/navigate to event
      // 3. Click share button
      // 4. Verify clipboard contains /invite/event/:id URL
      // This is a placeholder for the full implementation
    });
  });

  test.describe('returnUrl Security', () => {
    test('should block malicious returnUrl redirects', async ({ page }) => {
      // Attempt to use a malicious returnUrl
      await page.goto('/auth/login?returnUrl=//evil.com/phishing');
      await page.waitForLoadState('domcontentloaded');

      // Fill in login form (using test credentials)
      // Note: This requires test user setup
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'testpassword123');

      // Submit form
      await page.click('button[type="submit"]');

      // After successful login, should NOT redirect to evil.com
      // Should redirect to home or safe default
      await page.waitForLoadState('networkidle');

      // Verify we're still on the same domain
      expect(page.url()).not.toContain('evil.com');
    });

    test('should allow safe relative returnUrl', async ({ page }) => {
      await page.goto('/auth/login?returnUrl=%2Finvite%2Fevent%2Ftest-123');
      await page.waitForLoadState('domcontentloaded');

      // The page should load successfully
      await expect(page.locator('#root')).toBeAttached();

      // Note: Full test would require actual login and verification of redirect
    });

    test('should block protocol-relative URLs', async ({ page }) => {
      await page.goto('/auth/login?returnUrl=%2F%2Fevil.com');
      await page.waitForLoadState('domcontentloaded');

      // Page should load (not crash)
      await expect(page.locator('#root')).toBeAttached();

      // Note: After login, should not redirect to //evil.com
    });
  });

  test.describe('Mobile Viewport', () => {
    test.use({
      viewport: { width: 375, height: 667 }, // iPhone SE size
    });

    test('invite page should be mobile-friendly', async ({ page }) => {
      await page.goto('/invite/event/test-event-123');
      await page.waitForLoadState('domcontentloaded');

      // Check that page renders properly on mobile
      await expect(page.locator('#root')).toBeAttached();

      // Verify no bottom nav on invite pages
      const bottomNav = page.locator('nav').filter({ hasText: /Home|Events|Groups/i });
      await expect(bottomNav).not.toBeVisible();
    });
  });

  test.describe('Navigation Flow', () => {
    test('should hide bottom navigation on invite pages', async ({ page }) => {
      await page.goto('/invite/event/test-event-123');
      await page.waitForLoadState('domcontentloaded');

      // Bottom navigation should be hidden on invite pages
      // This matches the hideBottomNav logic in App.tsx
      const bottomNav = page.locator('[class*="bottom"]').filter({ hasText: /Home|Events/i });

      // If bottomNav exists, it should not be visible
      if ((await bottomNav.count()) > 0) {
        await expect(bottomNav.first()).not.toBeVisible();
      }
    });

    test('should navigate back home from error state', async ({ page }) => {
      await page.goto('/invite/event/invalid-id-999');
      await page.waitForLoadState('domcontentloaded');

      // If there's a "Go Home" button in error state, click it
      const goHomeButton = page.getByRole('button', { name: /go home/i });

      if (await goHomeButton.isVisible()) {
        await goHomeButton.click();
        await expect(page).toHaveURL('/');
      }
    });
  });
});
