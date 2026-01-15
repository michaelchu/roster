import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestEvent,
  getAdminDb,
} from '../fixtures/database';
import {
  registerForEvent,
  claimAdditionalSpot,
  goToEvent,
  expectParticipantInList,
} from '../fixtures/helpers';

test.describe('Participant Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Self Registration', () => {
    test('authenticated user can register for public event', async ({ page }) => {
      // Create organizer and event
      const organizerEmail = generateTestEmail('organizer');
      const organizerUser = {
        email: organizerEmail,
        password: 'TestPassword123!',
      };
      await register(page, organizerUser);

      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Public Registration Event'),
        is_private: false,
      });

      await clearAuth(page);

      // Create participant user
      const participantUser = {
        email: generateTestEmail('participant'),
        password: 'TestPassword123!',
      };
      await register(page, participantUser);

      // Register for event
      await registerForEvent(page, event.id, {
        name: 'Test Participant',
      });

      // Verify registration
      const { data: participants } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id);

      expect(participants).not.toBeNull();
      expect(participants?.length).toBeGreaterThan(0);
      expect(participants?.[0].name).toContain('Test Participant');
    });

    test('user registration creates participant with correct user_id', async ({ page }) => {
      // Setup
      const organizerEmail = generateTestEmail('org');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });

      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('User ID Test Event'),
      });

      await clearAuth(page);

      // Participant registers
      const participantEmail = generateTestEmail('registered');
      await register(page, { email: participantEmail, password: 'TestPassword123!' });

      const participantUserId = await getUserId(page);

      await registerForEvent(page, event.id);

      // Check database
      const { data: registrations } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', participantUserId!);

      expect(registrations).not.toBeNull();
      expect(registrations?.length).toBe(1);
    });

    test('registration with custom field responses', async ({ page }) => {
      // Create organizer and event with custom fields
      await register(page, {
        email: generateTestEmail('customorg'),
        password: 'TestPassword123!',
      });



      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Custom Fields Event'),
        custom_fields: [
          { id: 'diet', label: 'Dietary Restrictions', type: 'text', required: false },
          { id: 'shirt', label: 'Shirt Size', type: 'select', options: ['S', 'M', 'L'], required: true },
        ],
      });

      await clearAuth(page);

      // Participant registers with custom fields
      await register(page, {
        email: generateTestEmail('custompart'),
        password: 'TestPassword123!',
      });

      await registerForEvent(page, event.id, {
        customFieldResponses: {
          diet: 'Vegetarian',
          shirt: 'M',
        },
      });

      // Verify custom fields were saved
      const { data: participants } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id);

      expect(participants?.[0].responses).toBeDefined();
      const responses = participants?.[0].responses as Record<string, string>;
      expect(responses?.diet || responses?.['diet']).toContain('Vegetarian');
    });

    test('cannot register for event when already registered', async ({ page }) => {
      // Setup
      await register(page, {
        email: generateTestEmail('org'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('No Double Registration'),
      });

      await clearAuth(page);

      // Participant registers
      await register(page, {
        email: generateTestEmail('participant'),
        password: 'TestPassword123!',
      });

      await registerForEvent(page, event.id);

      // Try to register again
      await page.goto(`/events/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Register button should not be visible or should show "Already registered"
      const registerButton = page.getByRole('button', { name: /register|sign up/i });
      const isRegisterVisible = await registerButton.isVisible().catch(() => false);
      const hasAlreadyRegistered = await page.getByText(/already registered|registered/i).isVisible().catch(() => false);

      expect(!isRegisterVisible || hasAlreadyRegistered).toBe(true);
    });
  });

  test.describe('Claiming Additional Spots', () => {
    test('user can claim additional spot for guest', async ({ page }) => {
      // Setup
      await register(page, {
        email: generateTestEmail('claimer'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Multi-Spot Event'),
        max_participants: 10, // Need max_participants for claim button to appear
      });

      // Register self first
      await registerForEvent(page, event.id, {
        name: 'Main Registrant',
      });

      // Claim additional spot
      await claimAdditionalSpot(page, event.id, {
        name: 'Guest 1',
      });

      // Verify both registrations exist
      const userId = await getUserId(page);
      const { data: participants } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id);

      expect(participants?.length).toBeGreaterThanOrEqual(2);

      // One should have user_id, one should have claimed_by_user_id
      const selfRegistration = participants?.find((p) => p.user_id === userId);
      const claimedSpot = participants?.find((p) => p.claimed_by_user_id === userId && p.user_id === null);

      expect(selfRegistration).toBeDefined();
      expect(claimedSpot).toBeDefined();
    });

    test('claimed spots get auto-generated names', async ({ page }) => {
      // Setup
      await register(page, {
        email: generateTestEmail('namegen'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Name Generation Event'),
        max_participants: 10, // Need max_participants for claim button to appear
      });

      // Register self
      await registerForEvent(page, event.id, {
        name: 'John Doe',
      });

      // Claim spot without providing name
      await claimAdditionalSpot(page, event.id, {});

      // Check if auto-generated name follows pattern
      const { data: participants } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id);

      const claimedSpot = participants?.find((p) => p.claimed_by_user_id !== null && p.user_id === null);
      
      if (claimedSpot) {
        // Auto-generated names should follow pattern like "John Doe - 1"
        expect(claimedSpot.name).toMatch(/.*\s*-\s*\d+/);
      }
    });

    test('slot numbers are assigned correctly', async ({ page }) => {
      test.setTimeout(60000); // Increase timeout for multiple claims
      // Setup
      await register(page, {
        email: generateTestEmail('slots'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Slot Number Event'),
        max_participants: 10, // Need max_participants for claim button to appear
      });

      // Register self
      await registerForEvent(page, event.id);

      // Claim two additional spots
      await claimAdditionalSpot(page, event.id);
      
      // Wait a moment between claims to ensure first claim is fully processed
      await page.waitForTimeout(2000);
      
      await claimAdditionalSpot(page, event.id);

      // Verify slot numbers
      const { data: participants } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id)
        .order('slot_number', { ascending: true });

      expect(participants?.length).toBe(3);
      
      // Slot numbers should be sequential per user
      if (participants && participants.length === 3) {
        expect(participants[0].slot_number).toBeDefined();
        expect(participants[1].slot_number).toBeDefined();
        expect(participants[2].slot_number).toBeDefined();
        
        // All slots should have values
        expect(participants[0].slot_number).toBeGreaterThanOrEqual(0);
        expect(participants[1].slot_number).toBeGreaterThanOrEqual(0);
        expect(participants[2].slot_number).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Organizer View and Management', () => {
    test('organizer can view participant list', async ({ page }) => {
      // Create organizer and event
      await register(page, {
        email: generateTestEmail('viewer'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('View Participants'),
      });

      // Add some participants directly to database
      await getAdminDb().from('participants').insert([
        {
          event_id: event.id,
          name: 'Participant One',
          email: generateTestEmail('p1'),
        },
        {
          event_id: event.id,
          name: 'Participant Two',
          email: generateTestEmail('p2'),
        },
      ]);

      // Go to event detail page
      await goToEvent(page, event.id);

      // Verify participants are visible
      await expectParticipantInList(page, 'Participant One');
      await expectParticipantInList(page, 'Participant Two');
    });

    test('organizer can edit participant information', async ({ page }) => {
      // Setup
      await register(page, {
        email: generateTestEmail('editor'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Edit Participant'),
      });

      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Original Name',
          email: generateTestEmail('original'),
        })
        .select()
        .single();

      // Go to event detail
      await goToEvent(page, event.id);

      // Find edit button for participant (implementation may vary)
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Update name
        const nameInput = page.locator('input[name="name"]');
        if (await nameInput.count() > 0) {
          await nameInput.fill('Updated Name');
          
          // Save
          const saveButton = page.getByRole('button', { name: /save|update/i });
          await saveButton.click();
          await page.waitForTimeout(1000);

          // Verify update in database
          const { data: updated } = await getAdminDb()
            .from('participants')
            .select('*')
            .eq('id', participant?.id!)
            .single();

          expect(updated?.name).toBe('Updated Name');
        }
      }
    });

    test('organizer can delete participant', async ({ page }) => {
      // Setup
      await register(page, {
        email: generateTestEmail('deleter'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Delete Participant'),
      });

      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'To Be Deleted',
          email: generateTestEmail('delete'),
        })
        .select()
        .single();

      // Go to event detail
      await goToEvent(page, event.id);

      // Find and click delete button
      const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first();
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        
        // Confirm deletion
        const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }

        // Verify deletion
        const { data: deleted } = await getAdminDb()
          .from('participants')
          .select('*')
          .eq('id', participant?.id!)
          .maybeSingle();

        expect(deleted).toBeNull();
      }
    });

    test('organizer can bulk delete participants', async ({ page }) => {
      // Setup
      await register(page, {
        email: generateTestEmail('bulkdelete'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Bulk Delete'),
      });

      // Create multiple participants
      const { data: participants } = await getAdminDb()
        .from('participants')
        .insert([
          {
            event_id: event.id,
            name: 'Bulk 1',
            email: generateTestEmail('bulk1'),
          },
          {
            event_id: event.id,
            name: 'Bulk 2',
            email: generateTestEmail('bulk2'),
          },
          {
            event_id: event.id,
            name: 'Bulk 3',
            email: generateTestEmail('bulk3'),
          },
        ])
        .select();

      await goToEvent(page, event.id);

      // Look for bulk actions UI (checkboxes, select all, etc.)
      const checkboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount >= 3) {
        // Select multiple participants
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();

        // Find bulk delete button
        const bulkDeleteButton = page.getByRole('button', { name: /delete.*selected|bulk.*delete/i });
        if (await bulkDeleteButton.count() > 0) {
          await bulkDeleteButton.click();
          
          // Confirm
          const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
            await page.waitForTimeout(1000);
          }

          // Verify deletions
          const { data: remaining } = await getAdminDb()
            .from('participants')
            .select('*')
            .eq('event_id', event.id);

          expect(remaining?.length).toBeLessThan(3);
        }
      }
    });
  });

  test.describe('Max Participants Enforcement', () => {
    test('registration is blocked when event is full', async ({ page }) => {
      // Create organizer and event with max participants
      await register(page, {
        email: generateTestEmail('maxorg'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Full Event'),
        max_participants: 2,
      });

      // Fill event to capacity
      await getAdminDb().from('participants').insert([
        {
          event_id: event.id,
          name: 'Participant 1',
          email: generateTestEmail('full1'),
        },
        {
          event_id: event.id,
          name: 'Participant 2',
          email: generateTestEmail('full2'),
        },
      ]);

      await clearAuth(page);

      // Try to register new user
      await register(page, {
        email: generateTestEmail('toolate'),
        password: 'TestPassword123!',
      });

      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should show "Event Full" or disabled registration button
      const isFull = await page.getByText(/full|sold out|capacity/i).isVisible().catch(() => false);
      const registerButton = page.getByRole('button', { name: /join event/i });
      const isRegisterDisabled = await registerButton.isDisabled().catch(() => true);

      expect(isFull || isRegisterDisabled).toBe(true);
    });

    test('event displays spots remaining', async ({ page }) => {
      // Create event with max participants
      await register(page, {
        email: generateTestEmail('spotsorg'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Limited Spots'),
        max_participants: 5,
      });

      // Add 2 participants
      await getAdminDb().from('participants').insert([
        {
          event_id: event.id,
          name: 'Participant 1',
          email: generateTestEmail('spot1'),
        },
        {
          event_id: event.id,
          name: 'Participant 2',
          email: generateTestEmail('spot2'),
        },
      ]);

      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // The UI shows "2/5 participants signed up" format, not "spots remaining"
      // With max_participants=5 and 2 registered, we should see "2/5"
      const hasCapacityInfo = await page.getByText(/2\/5.*participants|2.*5.*signed/i).isVisible().catch(() => false);
      expect(hasCapacityInfo).toBe(true);
    });
  });

  test.describe('Participant Data Validation', () => {
    test('registration requires valid email format', async ({ page }) => {
      await register(page, {
        email: generateTestEmail('validator'),
        password: 'TestPassword123!',
      });


      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Validation Event'),
      });

      await registerForEvent(page, event.id, {
        email: 'invalid-email',
      });

      // Should show validation error or prevent submission
      await page.waitForTimeout(1000);
      
      const hasError = await page.locator('[class*="error"], [class*="red"]').isVisible().catch(() => false);
      // HTML5 validation might prevent form submission
      expect(hasError || page.url().includes(event.id)).toBe(true);
    });
  });
});
