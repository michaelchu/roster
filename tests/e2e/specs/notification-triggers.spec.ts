import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestEvent,
  getAdminDb,
} from '../fixtures/database';

/**
 * E2E tests for notification database triggers
 *
 * These tests verify that database triggers correctly queue notifications
 * when various actions occur (participant signup, withdrawal, payment changes, etc.)
 *
 * The tests check the notification_queue table directly to verify triggers fired.
 */
test.describe('Notification Triggers', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  /**
   * Helper to query notification queue for a specific notification
   */
  async function getNotificationFromQueue(
    recipientUserId: string,
    notificationType: string,
    eventId?: string
  ) {
    const query = getAdminDb()
      .from('notification_queue')
      .select('*')
      .eq('recipient_user_id', recipientUserId)
      .eq('notification_type', notificationType);

    if (eventId) {
      query.eq('event_id', eventId);
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(1);
    return data?.[0] || null;
  }

  /**
   * Helper to clean up notification queue entries for a test
   */
  async function cleanupNotificationQueue(eventId: string) {
    await getAdminDb().from('notification_queue').delete().eq('event_id', eventId);
    await getAdminDb().from('notifications').delete().eq('event_id', eventId);
  }

  test.describe('new_signup Notification', () => {
    test('organizer receives new_signup notification when participant registers', async ({
      page,
    }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Signup Notification Test'),
      });

      // Create participant (simulating registration by a different user)
      const participantEmail = generateTestEmail('participant');
      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Test Participant',
          email: participantEmail,
          user_id: null, // Guest registration (no user account)
        })
        .select()
        .single();

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify notification was queued for organizer
      const notification = await getNotificationFromQueue(organizerId!, 'new_signup', event.id);

      expect(notification).not.toBeNull();
      expect(notification.recipient_user_id).toBe(organizerId);
      expect(notification.notification_type).toBe('new_signup');
      expect(notification.event_id).toBe(event.id);
      expect(notification.participant_id).toBe(participant!.id);
      expect(notification.title).toContain('New signup');
      expect(notification.body).toContain('Test Participant');

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });

    test('organizer does NOT receive new_signup when signing up themselves', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('self-signup');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Self Signup Test'),
      });

      // Organizer signs up for their own event
      await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Organizer Self',
          email: organizerEmail,
          user_id: organizerId, // Same as organizer
        })
        .select()
        .single();

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify NO notification was queued for organizer (they signed up themselves)
      const notification = await getNotificationFromQueue(organizerId!, 'new_signup', event.id);

      expect(notification).toBeNull();

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });
  });

  test.describe('signup_confirmed Notification', () => {
    test('participant receives signup_confirmed when registering with user account', async ({
      page,
    }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Confirm Notification Test'),
      });

      await clearAuth(page);

      // Create participant user
      const participantEmail = generateTestEmail('participant');
      await register(page, { email: participantEmail, password: 'TestPassword123!' });
      const participantUserId = await getUserId(page);

      // Participant registers for event (with their user account)
      await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Registered User',
          email: participantEmail,
          user_id: participantUserId, // Has user account
        })
        .select()
        .single();

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify signup_confirmed notification was queued for participant
      const notification = await getNotificationFromQueue(
        participantUserId!,
        'signup_confirmed',
        event.id
      );

      expect(notification).not.toBeNull();
      expect(notification.recipient_user_id).toBe(participantUserId);
      expect(notification.notification_type).toBe('signup_confirmed');
      expect(notification.event_id).toBe(event.id);
      expect(notification.title).toContain('confirmed');

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });

    test('guest participant does NOT receive signup_confirmed (no user account)', async ({
      page,
    }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Guest No Confirm Test'),
      });

      // Guest registers (no user_id)
      const guestEmail = generateTestEmail('guest');
      await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Guest User',
          email: guestEmail,
          user_id: null, // No user account
        })
        .select()
        .single();

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify NO signup_confirmed notification was queued (no user to send to)
      // We check that there's no signup_confirmed in the queue for this event
      const { data } = await getAdminDb()
        .from('notification_queue')
        .select('*')
        .eq('event_id', event.id)
        .eq('notification_type', 'signup_confirmed');

      expect(data?.length || 0).toBe(0);

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });
  });

  test.describe('withdrawal Notification', () => {
    test('organizer receives withdrawal notification when participant leaves', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Withdrawal Test'),
      });

      // Create participant
      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Leaving Participant',
          email: generateTestEmail('leaving'),
          user_id: null,
        })
        .select()
        .single();

      // Wait a moment then delete participant (simulating withdrawal)
      await page.waitForTimeout(500);
      await getAdminDb().from('participants').delete().eq('id', participant!.id);

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify withdrawal notification was queued for organizer
      const notification = await getNotificationFromQueue(organizerId!, 'withdrawal', event.id);

      expect(notification).not.toBeNull();
      expect(notification.recipient_user_id).toBe(organizerId);
      expect(notification.notification_type).toBe('withdrawal');
      expect(notification.event_id).toBe(event.id);
      expect(notification.title).toContain('Withdrawal');
      expect(notification.body).toContain('Leaving Participant');

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });

    test('organizer does NOT receive withdrawal when removing themselves', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('self-withdraw');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Self Withdraw Test'),
      });

      // Organizer signs up for their own event
      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Organizer Self',
          email: organizerEmail,
          user_id: organizerId,
        })
        .select()
        .single();

      // Wait then organizer withdraws themselves
      await page.waitForTimeout(500);
      await getAdminDb().from('participants').delete().eq('id', participant!.id);

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify NO withdrawal notification was queued
      const notification = await getNotificationFromQueue(organizerId!, 'withdrawal', event.id);

      expect(notification).toBeNull();

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });
  });

  test.describe('payment_received Notification', () => {
    test('organizer receives payment_received when participant pays', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Payment Test'),
      });

      // Create participant with pending payment
      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Paying Participant',
          email: generateTestEmail('paying'),
          payment_status: 'pending',
        })
        .select()
        .single();

      // Wait a moment then mark as paid
      await page.waitForTimeout(500);
      await getAdminDb()
        .from('participants')
        .update({ payment_status: 'paid' })
        .eq('id', participant!.id);

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify payment_received notification was queued
      const notification = await getNotificationFromQueue(
        organizerId!,
        'payment_received',
        event.id
      );

      expect(notification).not.toBeNull();
      expect(notification.recipient_user_id).toBe(organizerId);
      expect(notification.notification_type).toBe('payment_received');
      expect(notification.event_id).toBe(event.id);
      expect(notification.participant_id).toBe(participant!.id);
      expect(notification.title).toContain('Payment');

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });

    test('no notification when payment status changes to non-paid value', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Non-Paid Test'),
      });

      // Create participant with paid status
      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Refund Participant',
          email: generateTestEmail('refund'),
          payment_status: 'paid',
        })
        .select()
        .single();

      // Clear any notifications from creation
      await cleanupNotificationQueue(event.id);

      // Wait a moment then change to pending (refund scenario)
      await page.waitForTimeout(500);
      await getAdminDb()
        .from('participants')
        .update({ payment_status: 'pending' })
        .eq('id', participant!.id);

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify NO payment_received notification was queued (only fires for paid)
      const notification = await getNotificationFromQueue(
        organizerId!,
        'payment_received',
        event.id
      );

      expect(notification).toBeNull();

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });
  });

  test.describe('capacity_reached Notification', () => {
    test('organizer receives capacity_reached when event fills up', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event with max capacity of 2
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Capacity Test'),
        max_participants: 2,
      });

      // Add first participant
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Participant 1',
        email: generateTestEmail('p1'),
      });

      // Wait briefly
      await page.waitForTimeout(500);

      // Add second participant (reaches capacity)
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Participant 2',
        email: generateTestEmail('p2'),
      });

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify capacity_reached notification was queued
      const notification = await getNotificationFromQueue(
        organizerId!,
        'capacity_reached',
        event.id
      );

      expect(notification).not.toBeNull();
      expect(notification.recipient_user_id).toBe(organizerId);
      expect(notification.notification_type).toBe('capacity_reached');
      expect(notification.event_id).toBe(event.id);
      expect(notification.title).toContain('capacity');

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });

    test('duplicate capacity_reached notifications are prevented', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event with max capacity of 2
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Duplicate Capacity Test'),
        max_participants: 2,
      });

      // Fill to capacity
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Participant 1',
        email: generateTestEmail('p1'),
      });
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Participant 2',
        email: generateTestEmail('p2'),
      });

      // Wait for trigger
      await page.waitForTimeout(1000);

      // Delete one participant
      await getAdminDb()
        .from('participants')
        .delete()
        .eq('event_id', event.id)
        .eq('name', 'Participant 2');

      // Add another (should reach capacity again)
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Participant 3',
        email: generateTestEmail('p3'),
      });

      // Wait for trigger
      await page.waitForTimeout(1000);

      // Verify only ONE capacity_reached notification exists (deduplication works)
      const { data } = await getAdminDb()
        .from('notification_queue')
        .select('*')
        .eq('event_id', event.id)
        .eq('notification_type', 'capacity_reached')
        .in('status', ['pending', 'processing', 'sent']);

      // Should be exactly 1 (duplicates prevented)
      expect(data?.length).toBe(1);

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });

    test('no capacity_reached when event has no max_participants', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event with NO max capacity
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('No Capacity Limit Test'),
        max_participants: null,
      });

      // Add participants
      for (let i = 0; i < 5; i++) {
        await getAdminDb().from('participants').insert({
          event_id: event.id,
          name: `Participant ${i}`,
          email: generateTestEmail(`p${i}`),
        });
      }

      // Wait for trigger
      await page.waitForTimeout(1000);

      // Verify NO capacity_reached notification (no limit set)
      const notification = await getNotificationFromQueue(
        organizerId!,
        'capacity_reached',
        event.id
      );

      expect(notification).toBeNull();

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });
  });

  test.describe('event_updated Notification', () => {
    test('participants receive event_updated when event details change', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Update Test'),
        location: 'Original Location',
      });

      await clearAuth(page);

      // Create participant with user account
      const participantEmail = generateTestEmail('participant');
      await register(page, { email: participantEmail, password: 'TestPassword123!' });
      const participantUserId = await getUserId(page);

      // Register participant
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Registered Participant',
        email: participantEmail,
        user_id: participantUserId,
      });

      // Clear signup notifications
      await cleanupNotificationQueue(event.id);

      // Update event details
      await getAdminDb()
        .from('events')
        .update({ location: 'New Location', name: 'Updated Event Name' })
        .eq('id', event.id);

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify event_updated notification was queued for participant
      const notification = await getNotificationFromQueue(
        participantUserId!,
        'event_updated',
        event.id
      );

      expect(notification).not.toBeNull();
      expect(notification.recipient_user_id).toBe(participantUserId);
      expect(notification.notification_type).toBe('event_updated');
      expect(notification.event_id).toBe(event.id);
      expect(notification.title).toContain('updated');

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });

    test('organizer does NOT receive event_updated for their own event', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Self Update Test'),
      });

      // Organizer registers for own event
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Organizer',
        email: organizerEmail,
        user_id: organizerId,
      });

      // Clear signup notifications
      await cleanupNotificationQueue(event.id);

      // Update event
      await getAdminDb().from('events').update({ location: 'New Location' }).eq('id', event.id);

      // Wait for trigger
      await page.waitForTimeout(1000);

      // Verify organizer did NOT receive event_updated (they made the change)
      const notification = await getNotificationFromQueue(organizerId!, 'event_updated', event.id);

      expect(notification).toBeNull();

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });

    test('guest participants do NOT receive event_updated (no user account)', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Guest Update Test'),
      });

      // Create guest participant (no user_id)
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Guest Participant',
        email: generateTestEmail('guest'),
        user_id: null,
      });

      // Clear signup notifications
      await cleanupNotificationQueue(event.id);

      // Update event
      await getAdminDb().from('events').update({ location: 'New Location' }).eq('id', event.id);

      // Wait for trigger
      await page.waitForTimeout(1000);

      // Verify NO event_updated notifications (guest has no user account)
      const { data } = await getAdminDb()
        .from('notification_queue')
        .select('*')
        .eq('event_id', event.id)
        .eq('notification_type', 'event_updated');

      expect(data?.length || 0).toBe(0);

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });
  });

  test.describe('event_cancelled Notification', () => {
    test('participants receive event_cancelled when event is deleted', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Cancel Test'),
      });

      await clearAuth(page);

      // Create participant with user account
      const participantEmail = generateTestEmail('participant');
      await register(page, { email: participantEmail, password: 'TestPassword123!' });
      const participantUserId = await getUserId(page);

      // Register participant
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Registered Participant',
        email: participantEmail,
        user_id: participantUserId,
      });

      // Clear signup notifications
      await cleanupNotificationQueue(event.id);

      // Store event ID before deletion
      const eventId = event.id;

      // Delete event (organizer cancels it)
      await getAdminDb().from('events').delete().eq('id', eventId);

      // Wait for trigger to process
      await page.waitForTimeout(1000);

      // Verify event_cancelled notification was queued for participant
      const notification = await getNotificationFromQueue(
        participantUserId!,
        'event_cancelled',
        eventId
      );

      expect(notification).not.toBeNull();
      expect(notification.recipient_user_id).toBe(participantUserId);
      expect(notification.notification_type).toBe('event_cancelled');
      expect(notification.event_id).toBe(eventId);
      expect(notification.title).toContain('cancelled');

      // Cleanup (event already deleted, just clean notifications)
      await getAdminDb().from('notification_queue').delete().eq('event_id', eventId);
      await getAdminDb().from('notifications').delete().eq('event_id', eventId);
    });

    test('organizer does NOT receive event_cancelled for their own event', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Self Cancel Test'),
      });

      // Organizer registers for own event
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Organizer',
        email: organizerEmail,
        user_id: organizerId,
      });

      // Clear signup notifications
      await cleanupNotificationQueue(event.id);

      const eventId = event.id;

      // Delete event
      await getAdminDb().from('events').delete().eq('id', eventId);

      // Wait for trigger
      await page.waitForTimeout(1000);

      // Verify organizer did NOT receive event_cancelled
      const notification = await getNotificationFromQueue(organizerId!, 'event_cancelled', eventId);

      expect(notification).toBeNull();

      // Cleanup
      await getAdminDb().from('notification_queue').delete().eq('event_id', eventId);
      await getAdminDb().from('notifications').delete().eq('event_id', eventId);
    });

    test('guest participants do NOT receive event_cancelled (no user account)', async ({
      page,
    }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Guest Cancel Test'),
      });

      // Create guest participant (no user_id)
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Guest Participant',
        email: generateTestEmail('guest'),
        user_id: null,
      });

      // Clear signup notifications
      await cleanupNotificationQueue(event.id);

      const eventId = event.id;

      // Delete event
      await getAdminDb().from('events').delete().eq('id', eventId);

      // Wait for trigger
      await page.waitForTimeout(1000);

      // Verify NO event_cancelled notifications (guest has no user account)
      const { data } = await getAdminDb()
        .from('notification_queue')
        .select('*')
        .eq('event_id', eventId)
        .eq('notification_type', 'event_cancelled');

      expect(data?.length || 0).toBe(0);

      // Cleanup
      await getAdminDb().from('notification_queue').delete().eq('event_id', eventId);
      await getAdminDb().from('notifications').delete().eq('event_id', eventId);
    });
  });

  test.describe('Multiple notifications from single action', () => {
    test('participant signup triggers both new_signup and signup_confirmed', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Multi Notification Test'),
      });

      await clearAuth(page);

      // Create participant with user account
      const participantEmail = generateTestEmail('participant');
      await register(page, { email: participantEmail, password: 'TestPassword123!' });
      const participantUserId = await getUserId(page);

      // Register participant
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Multi Notification User',
        email: participantEmail,
        user_id: participantUserId,
      });

      // Wait for triggers
      await page.waitForTimeout(1000);

      // Verify BOTH notifications were queued
      const newSignupNotif = await getNotificationFromQueue(organizerId!, 'new_signup', event.id);
      const signupConfirmedNotif = await getNotificationFromQueue(
        participantUserId!,
        'signup_confirmed',
        event.id
      );

      expect(newSignupNotif).not.toBeNull();
      expect(newSignupNotif.recipient_user_id).toBe(organizerId);

      expect(signupConfirmedNotif).not.toBeNull();
      expect(signupConfirmedNotif.recipient_user_id).toBe(participantUserId);

      // Cleanup
      await cleanupNotificationQueue(event.id);
    });
  });
});
