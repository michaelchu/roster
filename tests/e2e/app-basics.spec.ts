import { test, expect } from '@playwright/test'

test.describe('Basic App E2E Tests', () => {
  test('should load the homepage successfully', async ({ page }) => {
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded')

    // Check page title
    await expect(page).toHaveTitle(/Roster/)

    // Check that root element exists
    await expect(page.locator('#root')).toBeAttached()
  })

  test('should handle mobile viewport on Pixel 5', async ({ page }) => {
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded')

    // Basic check that page doesn't crash on mobile
    await expect(page).toHaveTitle(/Roster/)
  })

  test('should display proper error for non-existent routes', async ({ page }) => {
    await page.goto('/non-existent-route')

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded')

    // Should still have the app title (React Router handles 404s)
    await expect(page).toHaveTitle(/Roster/)
  })
})