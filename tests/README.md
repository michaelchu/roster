# E2E Testing with Playwright

This directory contains end-to-end tests for the Roster application using Playwright.

## Setup

Playwright is already configured and ready to use. The tests are isolated from the unit tests that run with Vitest.

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI (browser visible)
npm run test:e2e:headed

# Run tests with Playwright UI
npm run test:e2e:ui

# Debug tests step by step
npm run test:e2e:debug
```

## Test Structure

- **tests/e2e/**: Contains all E2E test files
- **playwright.config.ts**: Playwright configuration
- Tests run against `http://localhost:5173` (Vite dev server)

## Key Features

1. **Automatic Dev Server**: Playwright automatically starts the dev server before running tests
2. **Multi-browser Testing**: Tests run on both Desktop Chrome and Mobile Chrome
3. **Isolated from Unit Tests**: E2E tests don't interfere with Vitest unit tests
4. **Mobile-First**: Includes mobile viewport testing

## Writing Tests

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/')

    // Wait for DOM to load (avoid networkidle with Vite HMR)
    await page.waitForLoadState('domcontentloaded')

    await expect(page).toHaveTitle(/Roster/)
  })
})
```

### Important Notes

- **Avoid `networkidle`**: Use `domcontentloaded` instead of `networkidle` when waiting for page loads, as Vite's HMR keeps websocket connections open that prevent `networkidle` from resolving
- **Mobile Testing**: Tests run on both desktop and mobile viewports automatically

## Current Test Coverage

- ✅ Homepage loading
- ✅ Mobile viewport handling
- ✅ Error route handling
- ✅ Basic navigation

## Future Improvements

Consider adding tests for:
- Event creation flow
- Participant registration
- Authentication flows
- Real event detail interactions
- API integration with test database
- Visual regression testing

## Debugging

To debug failing tests:

1. Run with `--headed` to see browser
2. Use `--debug` to step through tests
3. Check screenshots in `test-results/` directory
4. Use `page.pause()` in test code for breakpoints