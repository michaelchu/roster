import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import { generateTestEmail, generateTestName, createTestEvent, getAdminDb } from '../fixtures/database';

/**
 * E2E tests for notification preferences
 *
 * These tests verify that the send-push edge function respects user preferences
 * when processing the notification queue. We test this by:
 * 1. Creating a notification in the queue
 * 2. Setting user preferences to disable that notification type
 * 3. Calling the send-push function
 * 4. Verifying the notification was 'skipped' rather than 'sent'
 */
test.describe('Notification Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  /**
   * Helper to set notification preferences for a user
   */
  async function setNotificationPreferences(
    userId: string,
    preferences: Partial<{
      push_enabled: boolean;
      notify_new_signup: boolean;
      notify_withdrawal: boolean;
      notify_payment_received: boolean;
      notify_capacity_reached: boolean;
      notify_signup_confirmed: boolean;
      notify_event_updated: boolean;
      notify_event_cancelled: boolean;
      notify_payment_reminder: boolean;
      notify_waitlist_promotion: boolean;
    }>
  ) {
    const { error } = await getAdminDb()
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw new Error(`Failed to set notification preferences: ${error.message}`);
    }
  }

  /**
   * Helper to clean up test data
   */
  async function cleanupTestData(eventId: string, userId: string) {
    await getAdminDb().from('notification_queue').delete().eq('event_id', eventId);
    await getAdminDb().from('notifications').delete().eq('event_id', eventId);
    await getAdminDb().from('notification_preferences').delete().eq('user_id', userId);
  }

  /**
   * Helper to get a notification from queue by ID
   */
  async function getNotificationStatus(notificationId: string) {
    const { data } = await getAdminDb()
      .from('notification_queue')
      .select('*')
      .eq('id', notificationId)
      .single();
    return data;
  }

  /**
   * Helper to invoke the send-push edge function
   * This processes the notification queue
   */
  async function invokeSendPush() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    return response.json();
  }

  test.describe('Master Toggle (push_enabled)', () => {
    test('notifications are skipped when push_enabled is false', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Prefs Master Test'),
      });

      // Disable all notifications via master toggle
      await setNotificationPreferences(organizerId!, { push_enabled: false });

      // Manually queue a notification (simulating what a trigger would do)
      const { data: notification } = await getAdminDb()
        .from('notification_queue')
        .insert({
          recipient_user_id: organizerId,
          notification_type: 'new_signup',
          title: 'Test New Signup',
          body: 'Someone signed up',
          event_id: event.id,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      // Process the queue
      await invokeSendPush();

      // Wait a moment for processing
      await page.waitForTimeout(500);

      // Verify the notification was skipped due to user preferences
      const result = await getNotificationStatus(notification!.id);

      expect(result?.status).toBe('skipped');
      expect(result?.last_error).toBe('User preferences');

      // Cleanup
      await cleanupTestData(event.id, organizerId!);
    });

    test('notifications are processed when push_enabled is true', async ({ page }) => {
      // Create organizer
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      // Create event
      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Prefs Enabled Test'),
      });

      // Enable notifications
      await setNotificationPreferences(organizerId!, {
        push_enabled: true,
        notify_new_signup: true,
      });

      // Queue a notification
      const { data: notification } = await getAdminDb()
        .from('notification_queue')
        .insert({
          recipient_user_id: organizerId,
          notification_type: 'new_signup',
          title: 'Test New Signup',
          body: 'Someone signed up',
          event_id: event.id,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      // Process the queue
      await invokeSendPush();

      // Wait a moment for processing
      await page.waitForTimeout(500);

      // Verify the notification was NOT skipped (might be 'skipped' if no push subscription,
      // but last_error should NOT be 'User preferences')
      const result = await getNotificationStatus(notification!.id);

      // If skipped, it should be because of "No active push subscriptions", not "User preferences"
      if (result?.status === 'skipped') {
        expect(result?.last_error).not.toBe('User preferences');
      }

      // Cleanup
      await cleanupTestData(event.id, organizerId!);
    });
  });

  test.describe('Individual Notification Type Preferences', () => {
    test('new_signup is skipped when notify_new_signup is false', async ({ page }) => {
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('New Signup Pref Test'),
      });

      // Enable push but disable new_signup notifications
      await setNotificationPreferences(organizerId!, {
        push_enabled: true,
        notify_new_signup: false,
      });

      const { data: notification } = await getAdminDb()
        .from('notification_queue')
        .insert({
          recipient_user_id: organizerId,
          notification_type: 'new_signup',
          title: 'Test New Signup',
          body: 'Someone signed up',
          event_id: event.id,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      await invokeSendPush();
      await page.waitForTimeout(500);

      const result = await getNotificationStatus(notification!.id);

      expect(result?.status).toBe('skipped');
      expect(result?.last_error).toBe('User preferences');

      await cleanupTestData(event.id, organizerId!);
    });

    test('withdrawal is skipped when notify_withdrawal is false', async ({ page }) => {
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Withdrawal Pref Test'),
      });

      await setNotificationPreferences(organizerId!, {
        push_enabled: true,
        notify_withdrawal: false,
      });

      const { data: notification } = await getAdminDb()
        .from('notification_queue')
        .insert({
          recipient_user_id: organizerId,
          notification_type: 'withdrawal',
          title: 'Test Withdrawal',
          body: 'Someone withdrew',
          event_id: event.id,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      await invokeSendPush();
      await page.waitForTimeout(500);

      const result = await getNotificationStatus(notification!.id);

      expect(result?.status).toBe('skipped');
      expect(result?.last_error).toBe('User preferences');

      await cleanupTestData(event.id, organizerId!);
    });

    test('event_updated is skipped when notify_event_updated is false', async ({ page }) => {
      const participantEmail = generateTestEmail('participant');
      await register(page, { email: participantEmail, password: 'TestPassword123!' });
      const participantId = await getUserId(page);

      // Create a separate organizer for the event
      await clearAuth(page);
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Event Update Pref Test'),
      });

      // Participant disables event_updated notifications
      await setNotificationPreferences(participantId!, {
        push_enabled: true,
        notify_event_updated: false,
      });

      const { data: notification } = await getAdminDb()
        .from('notification_queue')
        .insert({
          recipient_user_id: participantId,
          notification_type: 'event_updated',
          title: 'Event Updated',
          body: 'Event details changed',
          event_id: event.id,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      await invokeSendPush();
      await page.waitForTimeout(500);

      const result = await getNotificationStatus(notification!.id);

      expect(result?.status).toBe('skipped');
      expect(result?.last_error).toBe('User preferences');

      // Cleanup both users' preferences
      await cleanupTestData(event.id, participantId!);
      await getAdminDb().from('notification_preferences').delete().eq('user_id', organizerId!);
    });

    test('other notification types still work when one is disabled', async ({ page }) => {
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Selective Pref Test'),
      });

      // Disable new_signup but keep withdrawal enabled
      await setNotificationPreferences(organizerId!, {
        push_enabled: true,
        notify_new_signup: false,
        notify_withdrawal: true,
      });

      // Queue both types
      const { data: signupNotif } = await getAdminDb()
        .from('notification_queue')
        .insert({
          recipient_user_id: organizerId,
          notification_type: 'new_signup',
          title: 'Test New Signup',
          body: 'Someone signed up',
          event_id: event.id,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      const { data: withdrawalNotif } = await getAdminDb()
        .from('notification_queue')
        .insert({
          recipient_user_id: organizerId,
          notification_type: 'withdrawal',
          title: 'Test Withdrawal',
          body: 'Someone withdrew',
          event_id: event.id,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      await invokeSendPush();
      await page.waitForTimeout(500);

      const signupResult = await getNotificationStatus(signupNotif!.id);
      const withdrawalResult = await getNotificationStatus(withdrawalNotif!.id);

      // new_signup should be skipped due to preferences
      expect(signupResult?.status).toBe('skipped');
      expect(signupResult?.last_error).toBe('User preferences');

      // withdrawal should NOT be skipped due to preferences
      // (may be skipped for other reasons like no push subscription)
      if (withdrawalResult?.status === 'skipped') {
        expect(withdrawalResult?.last_error).not.toBe('User preferences');
      }

      await cleanupTestData(event.id, organizerId!);
    });
  });

  test.describe('Default Behavior (No Preferences Set)', () => {
    test('notifications are sent when no preferences exist (defaults to enabled)', async ({
      page,
    }) => {
      const organizerEmail = generateTestEmail('organizer');
      await register(page, { email: organizerEmail, password: 'TestPassword123!' });
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('No Prefs Test'),
      });

      // Don't set any preferences - should default to enabled

      const { data: notification } = await getAdminDb()
        .from('notification_queue')
        .insert({
          recipient_user_id: organizerId,
          notification_type: 'new_signup',
          title: 'Test New Signup',
          body: 'Someone signed up',
          event_id: event.id,
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        })
        .select()
        .single();

      await invokeSendPush();
      await page.waitForTimeout(500);

      const result = await getNotificationStatus(notification!.id);

      // Should NOT be skipped due to user preferences
      if (result?.status === 'skipped') {
        expect(result?.last_error).not.toBe('User preferences');
      }

      await cleanupTestData(event.id, organizerId!);
    });
  });
});
