import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import { generateTestEmail, generateTestName, createTestEvent, getAdminDb } from '../fixtures/database';

/**
 * E2E tests for notification delivery
 *
 * These tests verify that the queue_notification RPC function correctly bypasses
 * RLS to allow users to create notifications for other users. This catches the
 * bug where participants couldn't queue notifications for organizers due to RLS.
 *
 * Key scenario: When a participant signs up for an event, the service layer
 * calls queue_notification RPC to create a notification for the organizer.
 * The RPC uses SECURITY DEFINER to bypass RLS.
 */
test.describe('Notification Delivery', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  /**
   * Helper to clean up test data
   */
  async function cleanupTestData(options: {
    eventId?: string;
    organizerId?: string;
    participantId?: string;
  }) {
    const db = getAdminDb();

    if (options.eventId) {
      await db.from('notification_queue').delete().eq('event_id', options.eventId);
      await db.from('notifications').delete().eq('event_id', options.eventId);
      await db.from('participants').delete().eq('event_id', options.eventId);
      await db.from('events').delete().eq('id', options.eventId);
    }

    if (options.organizerId) {
      await db.from('notification_preferences').delete().eq('user_id', options.organizerId);
    }

    if (options.participantId) {
      await db.from('notification_preferences').delete().eq('user_id', options.participantId);
    }
  }

  /**
   * Helper to get notifications from queue for a specific recipient
   */
  async function getQueuedNotifications(recipientUserId: string, eventId: string) {
    const { data } = await getAdminDb()
      .from('notification_queue')
      .select('*')
      .eq('recipient_user_id', recipientUserId)
      .eq('event_id', eventId);
    return data || [];
  }

  /**
   * Helper to create a Supabase client authenticated as a specific user
   */
  function createAuthenticatedClient(accessToken: string) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  /**
   * Helper to get user's access token from page
   */
  async function getAccessToken(page: import('@playwright/test').Page): Promise<string | null> {
    return await page.evaluate(() => {
      try {
        const keys = Object.keys(localStorage).filter((key) => key.includes('auth-token'));
        if (keys.length > 0) {
          const sessionData = localStorage.getItem(keys[0]);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            return session?.access_token || null;
          }
        }
        return null;
      } catch {
        return null;
      }
    });
  }

  test.describe('RLS Policy for Cross-User Notifications', () => {
    test('participant can queue notification for organizer via RPC', async ({ page }) => {
      // Step 1: Create organizer and event
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('RLS Test Event'),
      });

      // Step 2: Create a separate participant user
      await clearAuth(page);
      const participantEmail = generateTestEmail('participant');
      await register(page, {
        email: participantEmail,
        password: 'TestPassword123!',
        fullName: 'Test Participant',
      });
      const participantId = await getUserId(page);
      const participantToken = await getAccessToken(page);

      // Step 3: As participant, call queue_notification RPC to create notification for organizer
      // This is the key test - the participant is creating a notification for a DIFFERENT user
      const participantClient = createAuthenticatedClient(participantToken!);

      const { error } = await participantClient.rpc('queue_notification', {
        p_recipient_user_id: organizerId, // Organizer is recipient (different from auth user)
        p_notification_type: 'new_signup',
        p_title: `New signup for ${event.name}`,
        p_body: 'Test Participant just signed up',
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: participantId,
        p_action_url: `/events/${event.id}/participants`,
      });

      // Step 4: Verify the RPC succeeded (no RLS error)
      expect(error).toBeNull();

      // Step 5: Verify notification was actually created
      const queuedNotifications = await getQueuedNotifications(organizerId!, event.id);
      const newSignupNotification = queuedNotifications.find(
        (n) => n.notification_type === 'new_signup'
      );

      expect(newSignupNotification).toBeDefined();
      expect(newSignupNotification?.recipient_user_id).toBe(organizerId);
      expect(newSignupNotification?.actor_user_id).toBe(participantId);

      // Cleanup
      await cleanupTestData({
        eventId: event.id,
        organizerId: organizerId!,
        participantId: participantId!,
      });
    });

    test('participant can queue their own signup_confirmed notification', async ({ page }) => {
      // Step 1: Create organizer and event
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Self Notification Test'),
      });

      // Step 2: Create participant
      await clearAuth(page);
      const participantEmail = generateTestEmail('participant');
      await register(page, {
        email: participantEmail,
        password: 'TestPassword123!',
        fullName: 'Self Notifier',
      });
      const participantId = await getUserId(page);
      const participantToken = await getAccessToken(page);

      // Step 3: Participant queues their own confirmation notification
      const participantClient = createAuthenticatedClient(participantToken!);

      const { error } = await participantClient.rpc('queue_notification', {
        p_recipient_user_id: participantId, // Self notification
        p_notification_type: 'signup_confirmed',
        p_title: 'Signup confirmed!',
        p_body: `You're registered for ${event.name}`,
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: null,
        p_action_url: `/events/${event.id}`,
      });

      expect(error).toBeNull();

      // Verify
      const queuedNotifications = await getQueuedNotifications(participantId!, event.id);
      const confirmationNotification = queuedNotifications.find(
        (n) => n.notification_type === 'signup_confirmed'
      );

      expect(confirmationNotification).toBeDefined();
      expect(confirmationNotification?.recipient_user_id).toBe(participantId);

      // Cleanup
      await cleanupTestData({
        eventId: event.id,
        organizerId: organizerId!,
        participantId: participantId!,
      });
    });

    test('RPC validates notification type', async ({ page }) => {
      // Create a user
      const userEmail = generateTestEmail('validator');
      await register(page, { email: userEmail, password: 'TestPassword123!' });
      const userId = await getUserId(page);
      const userToken = await getAccessToken(page);

      const userClient = createAuthenticatedClient(userToken!);

      // Try to queue with invalid notification type
      const { error } = await userClient.rpc('queue_notification', {
        p_recipient_user_id: userId,
        p_notification_type: 'invalid_type', // Invalid type
        p_title: 'Test',
        p_body: 'Test',
        p_event_id: null,
        p_participant_id: null,
        p_actor_user_id: null,
        p_action_url: null,
      });

      // Should fail with validation error
      expect(error).not.toBeNull();
      expect(error?.message).toContain('Invalid notification type');

      // Cleanup
      await getAdminDb().from('notification_preferences').delete().eq('user_id', userId!);
    });

    test('multiple notifications can be queued in sequence', async ({ page }) => {
      // Step 1: Create organizer and event
      const organizerEmail = generateTestEmail('multiorg');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Multi Notification Test'),
        max_participants: 2,
      });

      // Step 2: Create participant
      await clearAuth(page);
      const participantEmail = generateTestEmail('multipart');
      await register(page, {
        email: participantEmail,
        password: 'TestPassword123!',
      });
      const participantId = await getUserId(page);
      const participantToken = await getAccessToken(page);

      const participantClient = createAuthenticatedClient(participantToken!);

      // Step 3: Queue multiple notifications (simulating what happens on signup)
      // 1. new_signup for organizer
      const { error: error1 } = await participantClient.rpc('queue_notification', {
        p_recipient_user_id: organizerId,
        p_notification_type: 'new_signup',
        p_title: `New signup for ${event.name}`,
        p_body: 'Participant just signed up',
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: participantId,
        p_action_url: `/events/${event.id}/participants`,
      });

      // 2. signup_confirmed for participant
      const { error: error2 } = await participantClient.rpc('queue_notification', {
        p_recipient_user_id: participantId,
        p_notification_type: 'signup_confirmed',
        p_title: 'Signup confirmed!',
        p_body: `You're registered for ${event.name}`,
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: null,
        p_action_url: `/events/${event.id}`,
      });

      // 3. capacity_reached for organizer (simulating event filling up)
      const { error: error3 } = await participantClient.rpc('queue_notification', {
        p_recipient_user_id: organizerId,
        p_notification_type: 'capacity_reached',
        p_title: `${event.name} is now full!`,
        p_body: 'Your event has reached maximum capacity (2 participants)',
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: null,
        p_action_url: `/events/${event.id}`,
      });

      // All should succeed
      expect(error1).toBeNull();
      expect(error2).toBeNull();
      expect(error3).toBeNull();

      // Verify all notifications were created
      const organizerNotifications = await getQueuedNotifications(organizerId!, event.id);
      const participantNotifications = await getQueuedNotifications(participantId!, event.id);

      expect(organizerNotifications.length).toBe(2); // new_signup + capacity_reached
      expect(participantNotifications.length).toBe(1); // signup_confirmed

      // Cleanup
      await cleanupTestData({
        eventId: event.id,
        organizerId: organizerId!,
        participantId: participantId!,
      });
    });
  });

  test.describe('Withdrawal Notification via RPC', () => {
    test('participant can queue withdrawal notification for organizer', async ({ page }) => {
      // Setup
      const organizerEmail = generateTestEmail('withdraworg');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Withdrawal RPC Test'),
      });

      await clearAuth(page);
      const participantEmail = generateTestEmail('withdrawpart');
      await register(page, {
        email: participantEmail,
        password: 'TestPassword123!',
        fullName: 'Withdrawing User',
      });
      const participantId = await getUserId(page);
      const participantToken = await getAccessToken(page);

      const participantClient = createAuthenticatedClient(participantToken!);

      // Queue withdrawal notification
      const { error } = await participantClient.rpc('queue_notification', {
        p_recipient_user_id: organizerId,
        p_notification_type: 'withdrawal',
        p_title: `Withdrawal from ${event.name}`,
        p_body: 'Withdrawing User has withdrawn',
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: participantId,
        p_action_url: `/events/${event.id}/participants`,
      });

      expect(error).toBeNull();

      // Verify
      const queuedNotifications = await getQueuedNotifications(organizerId!, event.id);
      const withdrawalNotification = queuedNotifications.find(
        (n) => n.notification_type === 'withdrawal'
      );

      expect(withdrawalNotification).toBeDefined();
      expect(withdrawalNotification?.body).toContain('Withdrawing User');

      // Cleanup
      await cleanupTestData({
        eventId: event.id,
        organizerId: organizerId!,
        participantId: participantId!,
      });
    });
  });

  test.describe('Event Update Notifications (Organizer → Participants)', () => {
    test('organizer can queue event_updated notifications for multiple participants', async ({
      page,
    }) => {
      // Step 1: Create organizer and event
      const organizerEmail = generateTestEmail('updateorg');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);
      const organizerToken = await getAccessToken(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Event Update Test'),
      });

      // Step 2: Create two participants (simulating registered users)
      await clearAuth(page);
      const participant1Email = generateTestEmail('updatepart1');
      await register(page, { email: participant1Email, password: 'TestPassword123!' });
      const participant1Id = await getUserId(page);

      await clearAuth(page);
      const participant2Email = generateTestEmail('updatepart2');
      await register(page, { email: participant2Email, password: 'TestPassword123!' });
      const participant2Id = await getUserId(page);

      // Step 3: As organizer, queue event_updated notifications for both participants
      const organizerClient = createAuthenticatedClient(organizerToken!);

      // Queue for participant 1
      const { error: error1 } = await organizerClient.rpc('queue_notification', {
        p_recipient_user_id: participant1Id,
        p_notification_type: 'event_updated',
        p_title: `Event updated: ${event.name}`,
        p_body: 'The location has been updated',
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: organizerId,
        p_action_url: `/events/${event.id}`,
      });

      // Queue for participant 2
      const { error: error2 } = await organizerClient.rpc('queue_notification', {
        p_recipient_user_id: participant2Id,
        p_notification_type: 'event_updated',
        p_title: `Event updated: ${event.name}`,
        p_body: 'The location has been updated',
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: organizerId,
        p_action_url: `/events/${event.id}`,
      });

      // Both should succeed (organizer creating notifications for other users)
      expect(error1).toBeNull();
      expect(error2).toBeNull();

      // Verify notifications were created for both participants
      const participant1Notifications = await getQueuedNotifications(participant1Id!, event.id);
      const participant2Notifications = await getQueuedNotifications(participant2Id!, event.id);

      expect(participant1Notifications.length).toBe(1);
      expect(participant1Notifications[0].notification_type).toBe('event_updated');
      expect(participant2Notifications.length).toBe(1);
      expect(participant2Notifications[0].notification_type).toBe('event_updated');

      // Cleanup
      await cleanupTestData({
        eventId: event.id,
        organizerId: organizerId!,
      });
      await getAdminDb().from('notification_preferences').delete().eq('user_id', participant1Id!);
      await getAdminDb().from('notification_preferences').delete().eq('user_id', participant2Id!);
    });
  });

  test.describe('Event Cancellation Notifications (Organizer → Participants)', () => {
    test('organizer can queue event_cancelled notifications for multiple participants', async ({
      page,
    }) => {
      // Step 1: Create organizer
      const organizerEmail = generateTestEmail('cancelorg');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);
      const organizerToken = await getAccessToken(page);

      const eventName = generateTestName('Cancelled Event');

      // Step 2: Create participants
      await clearAuth(page);
      const participant1Email = generateTestEmail('cancelpart1');
      await register(page, { email: participant1Email, password: 'TestPassword123!' });
      const participant1Id = await getUserId(page);

      await clearAuth(page);
      const participant2Email = generateTestEmail('cancelpart2');
      await register(page, { email: participant2Email, password: 'TestPassword123!' });
      const participant2Id = await getUserId(page);

      // Step 3: As organizer, queue event_cancelled notifications
      // Note: event_id is null for cancelled events since the event is being deleted
      const organizerClient = createAuthenticatedClient(organizerToken!);

      const { error: error1 } = await organizerClient.rpc('queue_notification', {
        p_recipient_user_id: participant1Id,
        p_notification_type: 'event_cancelled',
        p_title: `Event cancelled: ${eventName}`,
        p_body: `The event "${eventName}" has been cancelled`,
        p_event_id: null, // Event is deleted
        p_participant_id: null,
        p_actor_user_id: organizerId,
        p_action_url: '/events',
      });

      const { error: error2 } = await organizerClient.rpc('queue_notification', {
        p_recipient_user_id: participant2Id,
        p_notification_type: 'event_cancelled',
        p_title: `Event cancelled: ${eventName}`,
        p_body: `The event "${eventName}" has been cancelled`,
        p_event_id: null,
        p_participant_id: null,
        p_actor_user_id: organizerId,
        p_action_url: '/events',
      });

      expect(error1).toBeNull();
      expect(error2).toBeNull();

      // Verify - need to query without event_id filter since it's null
      const { data: p1Notifications } = await getAdminDb()
        .from('notification_queue')
        .select('*')
        .eq('recipient_user_id', participant1Id!)
        .eq('notification_type', 'event_cancelled');

      const { data: p2Notifications } = await getAdminDb()
        .from('notification_queue')
        .select('*')
        .eq('recipient_user_id', participant2Id!)
        .eq('notification_type', 'event_cancelled');

      expect(p1Notifications?.length).toBe(1);
      expect(p2Notifications?.length).toBe(1);

      // Cleanup
      await getAdminDb()
        .from('notification_queue')
        .delete()
        .eq('recipient_user_id', participant1Id!)
        .eq('notification_type', 'event_cancelled');
      await getAdminDb()
        .from('notification_queue')
        .delete()
        .eq('recipient_user_id', participant2Id!)
        .eq('notification_type', 'event_cancelled');
      await getAdminDb().from('notification_preferences').delete().eq('user_id', organizerId!);
      await getAdminDb().from('notification_preferences').delete().eq('user_id', participant1Id!);
      await getAdminDb().from('notification_preferences').delete().eq('user_id', participant2Id!);
    });
  });

  test.describe('Payment Notifications', () => {
    test('organizer can queue payment_received notification', async ({ page }) => {
      // Setup: Create organizer and event
      const organizerEmail = generateTestEmail('paymentorg');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Payment Test Event'),
      });

      // Create a participant
      await clearAuth(page);
      const participantEmail = generateTestEmail('paymentpart');
      await register(page, {
        email: participantEmail,
        password: 'TestPassword123!',
        fullName: 'Paying User',
      });
      const participantId = await getUserId(page);
      const participantToken = await getAccessToken(page);

      // Payment status is typically updated by the participant or system
      // The notification goes to the organizer
      const participantClient = createAuthenticatedClient(participantToken!);

      const { error } = await participantClient.rpc('queue_notification', {
        p_recipient_user_id: organizerId,
        p_notification_type: 'payment_received',
        p_title: 'Payment received',
        p_body: `Paying User paid for ${event.name}`,
        p_event_id: event.id,
        p_participant_id: null,
        p_actor_user_id: participantId,
        p_action_url: `/events/${event.id}/participants`,
      });

      expect(error).toBeNull();

      // Verify
      const queuedNotifications = await getQueuedNotifications(organizerId!, event.id);
      const paymentNotification = queuedNotifications.find(
        (n) => n.notification_type === 'payment_received'
      );

      expect(paymentNotification).toBeDefined();
      expect(paymentNotification?.body).toContain('Paying User');

      // Cleanup
      await cleanupTestData({
        eventId: event.id,
        organizerId: organizerId!,
        participantId: participantId!,
      });
    });
  });
});
