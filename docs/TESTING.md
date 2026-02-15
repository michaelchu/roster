# Testing Patterns Reference

This document is a reference for AI coding assistants working with the test suite in this repository. It covers mocking patterns, fixtures, and templates for writing new tests. For test commands and how to run tests, see `CLAUDE.md`.

---

## 1. Test Architecture

### Unit / Integration Tests

- **Framework:** Vitest + Testing Library + happy-dom
- **Location:** `src/**/*.{test,spec}.{ts,tsx}`
- **Excludes:** `tests/**`, `**/e2e/**`
- **Config:** `vitest.config.ts`
- **Setup file:** `src/test/setup.ts` (runs before every test)
- **Globals:** `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` are available without imports

### E2E Tests

- **Framework:** Playwright with Chromium
- **Location:** `tests/e2e/**/*.spec.ts`
- **Config:** `playwright.config.ts`
- **Global setup:** `tests/e2e/global-setup.ts` (ensures Supabase is running)
- **Viewport:** 375x667 (mobile)
- **Retries:** 2 in CI, 0 locally
- **Workers:** 1 in CI, unlimited locally
- **Web servers:** Vite dev server on `localhost:5173` and Supabase edge functions on `127.0.0.1:54321`

---

## 2. Global Test Setup

The file `src/test/setup.ts` runs before every unit/integration test and configures the following:

### Supabase Mock

```typescript
vi.mock('@/lib/supabase');
```

Provides a chainable query builder mock. All tests that import `supabase` from `@/lib/supabase` receive the mock automatically.

### Feature Flag Mock

```typescript
vi.mock('@/services/featureFlagService');
```

All feature flags are enabled by default in tests.

### Browser API Mocks

The following browser APIs are stubbed so components that depend on them do not throw:

- `window.matchMedia` -- returns a media query list stub
- `IntersectionObserver` -- no-op observer
- `ResizeObserver` -- no-op observer
- `window.scrollTo` -- no-op function

### Environment Variables

- `VITE_VAPID_PUBLIC_KEY` is set to a test value so push notification code paths can execute.

### Test Environment

- **happy-dom** is used as a lightweight DOM implementation for speed.

---

## 3. Supabase Mocking

All mocking utilities live in `src/test/mocks/supabase.ts`.

### createQueryChain(finalResult)

Creates a chainable mock that simulates the Supabase query builder. Every method returns `this` for chaining, and the final call resolves to `finalResult`.

```typescript
import { createQueryChain } from '@/test/mocks/supabase';

const chain = createQueryChain({ data: mockEvent, error: null });
mockSupabase.from.mockReturnValue(chain as any);
```

Supported chainable methods:

| Category | Methods |
|---|---|
| Operations | `.select()`, `.insert()`, `.update()`, `.delete()`, `.upsert()` |
| Filters | `.eq()`, `.neq()`, `.gt()`, `.lt()`, `.gte()`, `.lte()`, `.in()`, `.is()`, `.or()`, `.not()`, `.like()`, `.ilike()`, `.filter()`, `.match()`, `.contains()`, `.containedBy()` |
| Modifiers | `.single()`, `.maybeSingle()`, `.limit()`, `.range()`, `.order()`, `.textSearch()` |

All methods return `this`. The chain itself resolves to `finalResult` when awaited or when a terminal method is called.

### createMockAuthValue(overrides?)

Creates a mock for `supabase.auth` with sensible defaults. Pass overrides to customize specific methods.

```typescript
import { createMockAuthValue } from '@/test/mocks/supabase';

const mockAuth = createMockAuthValue({
  getSession: vi.fn().mockResolvedValue({
    data: { session: { user: mockUser } },
    error: null,
  }),
});
```

### createMockUser(overrides?)

Creates a mock Supabase `User` object with default fields. Override any field as needed.

```typescript
import { createMockUser } from '@/test/mocks/supabase';

const user = createMockUser({
  id: 'custom-id',
  email: 'test@example.com',
});
```

---

## 4. Standard Service Test Pattern

Every service test follows this structure. The three mocks (`supabase`, `errorHandler`, `sessionValidator`) are the standard foundation.

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { createQueryChain } from '@/test/mocks/supabase';

// --- Standard mocks (copy these into every service test) ---

vi.mock('@/lib/supabase');

vi.mock('@/lib/errorHandler', async () => {
  const actual = await vi.importActual('@/lib/errorHandler');
  return {
    ...actual,
    throwIfSupabaseError: vi.fn((result) => {
      if (result.error) throw result.error;
      return result.data;
    }),
    requireData: vi.fn((data, operation) => {
      if (!data) throw new Error(`No data for ${operation}`);
      return data;
    }),
    fireAndForget: vi.fn(), // Prevent notification side effects
  };
});

vi.mock('@/lib/sessionValidator', () => ({
  requireValidSession: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

// --- Typed mock reference ---

const mockSupabase = vi.mocked(supabase);

describe('MyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should fetch entity by id', async () => {
      // Arrange
      const mockData = { id: '1', name: 'Test' };
      const chain = createQueryChain({ data: mockData, error: null });
      mockSupabase.from.mockReturnValue(chain as any);

      // Act
      const result = await myService.getById('1');

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('my_table');
      expect(chain.eq).toHaveBeenCalledWith('id', '1');
      expect(result).toEqual(mockData);
    });
  });
});
```

### Key points

- `throwIfSupabaseError` is re-implemented to actually throw on errors, preserving real behavior.
- `requireData` is re-implemented to throw on null data, preserving real behavior.
- `fireAndForget` is replaced with a no-op to prevent notification queuing side effects.
- `requireValidSession` returns a fixed user ID. Override with `vi.mocked(requireValidSession).mockResolvedValue(...)` when you need a different user.
- Always call `vi.clearAllMocks()` in `beforeEach` to reset call counts and return values.

---

## 5. Sequential Query Mocking

When a service method calls `supabase.from()` multiple times (e.g., fetch then insert, or read from multiple tables), use `mockReturnValueOnce` to return different chains in sequence.

```typescript
it('should handle multi-step operation', async () => {
  const fetchChain = createQueryChain({ data: mockEvent, error: null });
  const insertChain = createQueryChain({ data: newEvent, error: null });
  const labelsChain = createQueryChain({ data: [], error: null });

  mockSupabase.from
    .mockReturnValueOnce(fetchChain as any)   // 1st from() call
    .mockReturnValueOnce(insertChain as any)  // 2nd from() call
    .mockReturnValueOnce(labelsChain as any); // 3rd from() call

  const result = await service.duplicateEvent('event-1', 'org-1');
  expect(result.name).toBe('Original Event (Copy)');
});
```

The order of `mockReturnValueOnce` calls must match the order in which the service calls `supabase.from()`. Read the service source to determine the correct sequence.

---

## 6. Test Fixtures

### Events and Participants (`src/test/fixtures/events.ts`)

```typescript
export const mockOrganizer = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Organizer',
  created_at: '2024-01-01T00:00:00Z',
};

export const mockEvent = {
  id: 'V1StGXR8_Z',
  organizer_id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Event',
  description: 'Test description',
  datetime: '2024-01-15T10:00:00Z',
  end_datetime: null,
  location: 'Test Location',
  is_private: false,
  custom_fields: [],
  max_participants: null,
  group_id: null,
  parent_event_id: null,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockEventsList = [
  mockEvent,
  { ...mockEvent, id: 'ABcDeFgHiJ', name: 'Event 2' },
];

export const mockParticipant = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  event_id: 'V1StGXR8_Z',
  name: 'Test Participant',
  email: 'test@example.com',
  phone: null,
  notes: null,
  user_id: null,
  claimed_by_user_id: null,
  responses: {},
  payment_status: 'pending',
  payment_marked_at: null,
  payment_notes: null,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockParticipantsList = [
  mockParticipant,
  { ...mockParticipant, id: '...', name: 'Participant 2', created_at: '2024-01-01T00:01:00Z' },
];

export const mockLabel = {
  id: '770e8400-e29b-41d4-a716-446655440002',
  event_id: 'V1StGXR8_Z',
  name: 'VIP',
  color: '#blue',
};
```

### Groups (`src/test/fixtures/groups.ts`)

```typescript
export const mockGroup = {
  id: 'test-group',
  organizer_id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Group',
  description: 'Test description',
  created_at: '2024-01-01T00:00:00Z',
  event_count: 2,
  participant_count: 5,
};

export const mockGroupsList = [
  mockGroup,
  { ...mockGroup, id: 'test-group-2', name: 'Group 2' },
];
```

---

## 7. Component Testing

### Custom Render (`src/test/utils/test-utils.tsx`)

The custom `render` function wraps components in all required providers: `MemoryRouter`, `ThemeProvider`, `FontSizeProvider`, and other context providers needed by the app.

```typescript
import { render, screen } from '@/test/utils/test-utils';

test('component renders', () => {
  render(<MyComponent prop="value" />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

Always import `render` and `screen` from `@/test/utils/test-utils`, not from `@testing-library/react` directly.

### Screen Query Reference

Use `screen` queries rather than destructuring from `render`:

| Query | Behavior |
|---|---|
| `screen.getByText('...')` | Throws if not found |
| `screen.getByRole('button', { name: '...' })` | Throws if not found |
| `screen.getByTestId('...')` | Throws if not found |
| `screen.queryByText('...')` | Returns `null` if not found (use for asserting absence) |
| `screen.findByText('...')` | Async, waits for element to appear (use with `await`) |

### Asserting Absence

```typescript
expect(screen.queryByText('Should Not Exist')).not.toBeInTheDocument();
```

### Waiting for Async Content

```typescript
const element = await screen.findByText('Loaded Content');
expect(element).toBeInTheDocument();
```

---

## 8. E2E Fixtures

### Auth Fixtures (`tests/e2e/fixtures/auth.ts`)

```typescript
interface TestUser {
  email: string;
  password: string;
  fullName?: string;
  id?: string;
}

// Navigate to /auth/login, fill email + password, submit
login(page: Page, user: TestUser): Promise<void>

// Navigate to /auth/register, fill form, submit. Returns userId
register(page: Page, user: TestUser): Promise<string>

// Navigate to /settings, click sign out
logout(page: Page): Promise<void>

// Check localStorage for session + verify UI state
isAuthenticated(page: Page): Promise<boolean>

// Extract user ID from Supabase session in localStorage
getUserId(page: Page): Promise<string | null>

// Clear cookies and all storage
clearAuth(page: Page): Promise<void>
```

### Database Fixtures (`tests/e2e/fixtures/database.ts`)

Two Supabase clients are available:

- `getTestDb()` -- uses the anon key, respects RLS policies
- `getAdminDb()` -- uses the service role key, bypasses RLS (use for setup and teardown)

#### Data Generation

```typescript
// Generates '{prefix}-{timestamp}-{random}@e2etest.local'
generateTestEmail(prefix?: string): string

// Generates '{prefix} {timestamp}'
generateTestName(prefix?: string): string
```

#### CRUD Helpers (all use admin DB)

```typescript
// Creates an event with defaults, returns the full event row
createTestEvent(organizerId: string, eventData?: Partial<Event>): Promise<Event>

// Creates a group with defaults, returns the full group row
createTestGroup(organizerId: string, groupData?: Partial<Group>): Promise<Group>

// Creates a participant with defaults, returns the full participant row
createTestParticipant(eventId: string, data?: Partial<Participant>): Promise<Participant>
```

#### Feature Flags

```typescript
// Creates a user-level override enabling the flag
enableFeatureFlagForUser(userId: string, flagKey: string): Promise<void>

// Deletes the user-level override
disableFeatureFlagForUser(userId: string, flagKey: string): Promise<void>
```

#### Cleanup

```typescript
// Deletes test data in dependency order: participants -> events -> groups
cleanupTestData(ids: {
  eventIds?: string[];
  groupIds?: string[];
  participantIds?: string[];
}): Promise<void>
```

### UI Helpers (`tests/e2e/fixtures/helpers.ts`)

#### Event Operations

```typescript
// Fill the event creation form and submit. Returns { name }
createEventViaUI(page: Page, eventData?: Partial<EventData>): Promise<{ name: string }>

// Navigate to edit page, update fields, save
editEventViaUI(page: Page, eventId: string, updates: Partial<EventData>): Promise<void>

// Delete event via the edit page
deleteEventViaUI(page: Page, eventId: string): Promise<void>
```

#### Participant Operations

```typescript
// Navigate to /signup/{eventId}, fill registration form, submit
registerForEvent(page: Page, eventId: string, data?: Partial<ParticipantData>): Promise<void>

// Claim an additional spot for another person
claimAdditionalSpot(page: Page, eventId: string, data?: Partial<ParticipantData>): Promise<void>
```

#### Group Operations

```typescript
// Fill the group creation form and submit. Returns { name }
createGroupViaUI(page: Page, groupData?: Partial<GroupData>): Promise<{ name: string }>
```

#### Navigation

```typescript
goToEvent(page: Page, eventId: string): Promise<void>       // /signup/{eventId}
goToGroup(page: Page, groupId: string): Promise<void>       // /groups/{groupId}
goToEventsList(page: Page): Promise<void>                    // /events + click Organizing tab
goToGroupsList(page: Page): Promise<void>                    // /groups
```

#### Assertions

```typescript
expectEventVisible(page: Page, eventName: string): Promise<void>        // 5s timeout
expectEventNotVisible(page: Page, eventName: string): Promise<void>     // 5s timeout
expectParticipantInList(page: Page, name: string): Promise<void>
expectGroupVisible(page: Page, groupName: string): Promise<void>
```

#### Utilities

```typescript
waitForApiResponse(page: Page, urlPattern: string | RegExp): Promise<void>
dismissAllToasts(page: Page): Promise<void>   // Clears Sonner toast notifications
```

---

## 9. E2E Test Structure

Complete template for a new E2E test file:

```typescript
import { test, expect } from '@playwright/test';
import { login, register, clearAuth, getUserId } from '../fixtures/auth';
import {
  createTestEvent,
  cleanupTestData,
  generateTestEmail,
} from '../fixtures/database';
import {
  createEventViaUI,
  expectEventVisible,
} from '../fixtures/helpers';

test.describe('Feature Name', () => {
  const testUser = {
    email: generateTestEmail('feature'),
    password: 'TestPassword123!',
    fullName: 'Test User',
  };
  const createdEventIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.afterEach(async () => {
    await cleanupTestData({ eventIds: createdEventIds });
  });

  test('user can perform action', async ({ page }) => {
    // 1. Authenticate
    await register(page, testUser);

    // 2. Set up data (prefer database fixtures for complex scenarios)
    const userId = await getUserId(page);
    const event = await createTestEvent(userId!, { name: 'Test Event' });
    createdEventIds.push(event.id);

    // 3. Interact via UI
    await page.goto(`/signup/${event.id}`);

    // 4. Assert
    await expectEventVisible(page, 'Test Event');
  });
});
```

### E2E Best Practices

- Call `clearAuth(page)` in `beforeEach` to ensure a clean session.
- Track created resource IDs and clean them up in `afterEach` with `cleanupTestData`.
- Prefer creating test data via database fixtures (`createTestEvent`, etc.) rather than via UI when the test is not specifically testing creation flows.
- Use `generateTestEmail` to avoid collisions between parallel test runs.
- Use `await` with `expect` for Playwright locator assertions -- they auto-retry.

---

## 10. Data Conventions

### ID Formats

| Entity | Format | Example |
|---|---|---|
| Users / Organizers / Participants | UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |
| Events | nanoid (10 characters) | `V1StGXR8_Z` |
| Groups | String | `test-group` |

### Test Emails

Pattern: `{prefix}-{timestamp}-{random}@e2etest.local`

Generated by `generateTestEmail(prefix?)`. The `@e2etest.local` domain ensures test emails never reach real inboxes.

### Timestamps

All timestamps use ISO 8601 format: `2024-01-01T00:00:00Z`

### Payment Status Values

`'pending'` | `'paid'` | `'waived'`

---

## 11. How to Write a New Test

### New Unit Test for a Service

1. Create the file at `src/services/__tests__/myService.test.ts` (or alongside the service as `myService.test.ts`).
2. Copy the standard mocks from [Section 4](#4-standard-service-test-pattern).
3. Import the service under test.
4. Import fixtures from `@/test/fixtures/` as needed.
5. Write tests using the Arrange / Act / Assert pattern.

Template:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { createQueryChain } from '@/test/mocks/supabase';
import { myService } from '../myService';
import { mockEvent } from '@/test/fixtures/events';

vi.mock('@/lib/supabase');
vi.mock('@/lib/errorHandler', async () => {
  const actual = await vi.importActual('@/lib/errorHandler');
  return {
    ...actual,
    throwIfSupabaseError: vi.fn((result) => {
      if (result.error) throw result.error;
      return result.data;
    }),
    requireData: vi.fn((data, operation) => {
      if (!data) throw new Error(`No data for ${operation}`);
      return data;
    }),
    fireAndForget: vi.fn(),
  };
});
vi.mock('@/lib/sessionValidator', () => ({
  requireValidSession: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

const mockSupabase = vi.mocked(supabase);

describe('myService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return data on success', async () => {
    const chain = createQueryChain({ data: mockEvent, error: null });
    mockSupabase.from.mockReturnValue(chain as any);

    const result = await myService.getEvent('V1StGXR8_Z');

    expect(mockSupabase.from).toHaveBeenCalledWith('events');
    expect(result).toEqual(mockEvent);
  });

  it('should throw on Supabase error', async () => {
    const chain = createQueryChain({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
    });
    mockSupabase.from.mockReturnValue(chain as any);

    await expect(myService.getEvent('bad-id')).rejects.toThrow();
  });
});
```

### New Unit Test for a Component

1. Create the file alongside the component: `MyComponent.test.tsx`.
2. Import `render` and `screen` from `@/test/utils/test-utils`.
3. Mock any services the component calls.

Template:

```typescript
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { MyComponent } from './MyComponent';

vi.mock('@/services/myService', () => ({
  myService: {
    getData: vi.fn().mockResolvedValue([{ id: '1', name: 'Item' }]),
  },
}));

describe('MyComponent', () => {
  it('should render items', async () => {
    render(<MyComponent />);

    const item = await screen.findByText('Item');
    expect(item).toBeInTheDocument();
  });

  it('should show empty state when no data', async () => {
    const { myService } = await import('@/services/myService');
    vi.mocked(myService.getData).mockResolvedValueOnce([]);

    render(<MyComponent />);

    const emptyMessage = await screen.findByText('No items found');
    expect(emptyMessage).toBeInTheDocument();
  });
});
```

### New E2E Test

1. Create the file at `tests/e2e/my-feature.spec.ts`.
2. Import fixtures from `../fixtures/auth`, `../fixtures/database`, and `../fixtures/helpers`.
3. Use `generateTestEmail` for unique test users.
4. Clean up all created data in `afterEach`.

Template:

```typescript
import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  createTestEvent,
  cleanupTestData,
  generateTestEmail,
} from '../fixtures/database';

test.describe('My Feature', () => {
  const testUser = {
    email: generateTestEmail('myfeature'),
    password: 'TestPassword123!',
    fullName: 'E2E Test User',
  };
  const createdEventIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.afterEach(async () => {
    await cleanupTestData({ eventIds: createdEventIds });
  });

  test('should do the thing', async ({ page }) => {
    const userId = await register(page, testUser);

    const event = await createTestEvent(userId, {
      name: 'E2E Test Event',
    });
    createdEventIds.push(event.id);

    await page.goto(`/signup/${event.id}`);
    await expect(page.getByText('E2E Test Event')).toBeVisible();
  });
});
```
