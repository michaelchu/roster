import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import { generateTestEmail, generateTestName, createTestEvent, getAdminDb } from '../fixtures/database';
import { goToEvent } from '../fixtures/helpers';

test.describe('Event Capacity Enforcement', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('UI Enforcement', () => {
    test('shows "Event Full" button when event reaches max_participants', async ({ page }) => {
      // Create organizer and event with max 2 participants
      await register(page, {
        email: generateTestEmail('capacityorg'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Capacity Test Event'),
        max_participants: 2,
      });

      // Add organizer as participant (slot 1)
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: organizerId!,
        name: 'Organizer',
        email: 'organizer@test.com',
      });

      // Add second participant to fill the event
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: null,
        name: 'Second Participant',
        email: 'second@test.com',
      });

      await clearAuth(page);

      // Create new user who wants to join
      await register(page, {
        email: generateTestEmail('wannajoin'),
        password: 'TestPassword123!',
      });

      // Navigate to the full event
      await goToEvent(page, event.id);
      await page.waitForTimeout(1000);

      // Should see "Event Full" button disabled
      const eventFullButton = page.getByRole('button', { name: /Event Full/i });
      await expect(eventFullButton).toBeVisible();
      await expect(eventFullButton).toBeDisabled();
    });

    test('registered user can still withdraw from full event', async ({ page }) => {
      // Create organizer and event with max 2 participants
      await register(page, {
        email: generateTestEmail('withdraworg'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Withdraw Test Event'),
        max_participants: 2,
      });

      await clearAuth(page);

      // Create user who will register
      await register(page, {
        email: generateTestEmail('registereduser'),
        password: 'TestPassword123!',
      });

      const userId = await getUserId(page);

      // Add this user as participant
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: userId!,
        name: 'Registered User',
        email: 'registered@test.com',
      });

      // Add second participant to fill the event
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: null,
        name: 'Second Participant',
        email: 'second@test.com',
      });

      // Navigate to the full event
      await goToEvent(page, event.id);
      await page.waitForLoadState('networkidle');

      // Wait for participant list to show the registered user's name
      // This ensures the participant data has been loaded before checking the button
      await expect(page.getByText('Test User')).toBeVisible({ timeout: 10000 });

      // Registered user should see Withdraw or Modify Registration button, not Event Full
      const withdrawButton = page.getByRole('button', { name: /withdraw|modify registration/i });
      await expect(withdrawButton).toBeVisible({ timeout: 10000 });
      await expect(withdrawButton).toBeEnabled();
    });

    test('shows participant count correctly when event is full', async ({ page }) => {
      // Create organizer and event
      await register(page, {
        email: generateTestEmail('countorg'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Count Test Event'),
        max_participants: 3,
      });

      // Fill the event with 3 participants
      for (let i = 1; i <= 3; i++) {
        await getAdminDb().from('participants').insert({
          event_id: event.id,
          user_id: null,
          name: `Participant ${i}`,
          email: `participant${i}@test.com`,
        });
      }

      await clearAuth(page);

      // Create new user
      await register(page, {
        email: generateTestEmail('viewcount'),
        password: 'TestPassword123!',
      });

      // Navigate to the full event
      await goToEvent(page, event.id);
      await page.waitForTimeout(1000);

      // Should show 3/3 participants
      const countText = page.getByText(/3\/3.*participants/i);
      await expect(countText).toBeVisible();
    });
  });

  test.describe('Database Enforcement', () => {
    test('database rejects registration when event is full', async ({ page }) => {
      // Create organizer and event with max 1 participant
      await register(page, {
        email: generateTestEmail('dborg'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('DB Enforcement Event'),
        max_participants: 1,
      });

      // Add one participant to fill the event
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: null,
        name: 'First Participant',
        email: 'first@test.com',
      });

      // Try to add another participant directly to database - should fail
      const { error } = await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: null,
        name: 'Overflow Participant',
        email: 'overflow@test.com',
      });

      // Should get an error about capacity
      expect(error).not.toBeNull();
      expect(error?.message).toContain('full capacity');
    });

    test('database allows registration when under capacity', async ({ page }) => {
      // Create organizer and event with max 3 participants
      await register(page, {
        email: generateTestEmail('underorg'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Under Capacity Event'),
        max_participants: 3,
      });

      // Add first participant
      const { error: error1 } = await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: null,
        name: 'First Participant',
        email: 'first@test.com',
      });
      expect(error1).toBeNull();

      // Add second participant - should succeed
      const { error: error2 } = await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: null,
        name: 'Second Participant',
        email: 'second@test.com',
      });
      expect(error2).toBeNull();

      // Verify both were added
      const { data: participants } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id);

      expect(participants?.length).toBe(2);
    });

    test('database allows unlimited registrations when max_participants is null', async ({
      page,
    }) => {
      // Create organizer and event without max_participants
      await register(page, {
        email: generateTestEmail('unlimitedorg'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Unlimited Event'),
        max_participants: null,
      });

      // Add multiple participants - all should succeed
      for (let i = 1; i <= 5; i++) {
        const { error } = await getAdminDb().from('participants').insert({
          event_id: event.id,
          user_id: null,
          name: `Participant ${i}`,
          email: `participant${i}@test.com`,
        });
        expect(error).toBeNull();
      }

      // Verify all were added
      const { data: participants } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id);

      expect(participants?.length).toBe(5);
    });
  });

  test.describe('Edge Cases', () => {
    test('spot opens up when participant withdraws from full event', async ({ page }) => {
      // Create organizer and event with max 2 participants
      await register(page, {
        email: generateTestEmail('edgeorg'),
        password: 'TestPassword123!',
      });

      const organizerId = await getUserId(page);
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Edge Case Event'),
        max_participants: 2,
      });

      // Fill the event
      const { data: p1 } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          user_id: null,
          name: 'First Participant',
          email: 'first@test.com',
        })
        .select()
        .single();

      await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: null,
        name: 'Second Participant',
        email: 'second@test.com',
      });

      // Remove first participant
      await getAdminDb().from('participants').delete().eq('id', p1!.id);

      // Now adding a new participant should succeed
      const { error } = await getAdminDb().from('participants').insert({
        event_id: event.id,
        user_id: null,
        name: 'New Participant',
        email: 'new@test.com',
      });

      expect(error).toBeNull();

      // Verify count is back to 2
      const { data: participants } = await getAdminDb()
        .from('participants')
        .select('*')
        .eq('event_id', event.id);

      expect(participants?.length).toBe(2);
    });
  });
});
