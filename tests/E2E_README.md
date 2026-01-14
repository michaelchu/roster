# E2E Testing with Playwright

Comprehensive end-to-end tests for the Roster application using Playwright.

## Overview

These tests validate complete user journeys through the application, from registration to event management. Tests interact with a real Supabase backend to ensure database integration, RLS policies, and business logic work correctly.

## Setup

### Prerequisites

1. **Install Playwright browsers:**
   ```bash
   npx playwright install
   ```

2. **Configure test database:**
   The tests use your existing Supabase configuration from `.env`. For production CI/CD, consider using a dedicated test Supabase project.

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

# Run specific test file
npx playwright test specs/auth.spec.ts
```

## Test Structure

```
tests/e2e/
├── fixtures/
│   ├── auth.ts       # Authentication helpers (login, register, logout)
│   └── database.ts   # Database utilities (test data creation/cleanup)
├── specs/
│   └── auth.spec.ts  # Authentication flows
├── app-basics.spec.ts # Smoke tests
└── README.md
```

## Test Categories

### Smoke Tests (`app-basics.spec.ts`)
- Basic app functionality
- Page loading
- 404 handling
- Offline resilience

### Authentication (`specs/auth.spec.ts`)
- User registration (success, validation, duplicates)
- Login (success, errors, security)
- Logout and session management
- Session persistence
- returnUrl security

## Key Features

✅ **Real Database Integration** - Tests use actual Supabase, validating RLS policies  
✅ **Per-Test Isolation** - Each test creates and cleans up its own data  
✅ **Mobile-First** - Primary tests run on mobile viewport (Pixel 5)  
✅ **No Mocking** - Tests validate real application behavior

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { register, clearAuth } from '../fixtures/auth';
import { generateTestEmail } from '../fixtures/database';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should do something', async ({ page }) => {
    const user = {
      email: generateTestEmail('mytest'),
      password: 'TestPassword123!',
    };
    
    await register(page, user);
    await page.goto('/my-feature');
    
    // Your test logic
  });
});
```

## Best Practices

1. **Wait for DOM, not network**: Use `domcontentloaded` instead of `networkidle`
2. **Generate unique data**: Always use `generateTestEmail()` and `generateTestName()`
3. **Clean up**: Use `afterEach` hooks to delete test data
4. **Be specific**: Use descriptive test names
5. **Test user journeys**: Focus on complete workflows

## Debugging

```bash
# View test execution
npm run test:e2e:headed

# Step through tests
npm run test:e2e:debug

# View trace for failed tests
npx playwright show-trace test-results/[test-name]/trace.zip
```
