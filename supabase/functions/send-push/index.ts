/**
 * Send Push Notification Edge Function
 *
 * Processes the notification queue and sends push notifications to subscribed devices.
 * Also saves notifications to the inbox for history.
 *
 * Triggered by:
 * - Database webhook when items are added to notification_queue
 * - Manual invocation for testing
 * - process-scheduled function for scheduled notifications
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import webpush from 'npm:web-push@3.6.7';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@roster.app';

// Configure web-push with VAPID credentials
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Types
interface QueueItem {
  id: string;
  recipient_user_id: string;
  notification_type: string;
  title: string;
  body: string;
  event_id: string | null;
  participant_id: string | null;
  actor_user_id: string | null;
  action_url: string | null;
  scheduled_for: string;
  status: string;
  attempts: number;
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

interface NotificationPreferences {
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
}

// Preference key mapping
const PREF_MAP: Record<string, keyof NotificationPreferences> = {
  new_signup: 'notify_new_signup',
  withdrawal: 'notify_withdrawal',
  payment_received: 'notify_payment_received',
  capacity_reached: 'notify_capacity_reached',
  signup_confirmed: 'notify_signup_confirmed',
  event_updated: 'notify_event_updated',
  event_cancelled: 'notify_event_cancelled',
  payment_reminder: 'notify_payment_reminder',
  waitlist_promotion: 'notify_waitlist_promotion',
};

/**
 * Check if user wants to receive this notification type
 */
function shouldSendNotification(
  prefs: NotificationPreferences | null,
  notificationType: string
): boolean {
  // If no preferences, default to sending
  if (!prefs) return true;

  // Check master toggle
  if (!prefs.push_enabled) return false;

  // Check specific notification type
  const prefKey = PREF_MAP[notificationType];
  if (prefKey && prefs[prefKey] === false) return false;

  return true;
}

/**
 * Send a Web Push notification using the web-push library
 */
async function sendWebPush(
  subscription: PushSubscription,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<boolean> {
  // Check if VAPID keys are configured
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('VAPID keys not configured, skipping push');
    return false;
  }

  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key,
      },
    };

    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    console.log('Push sent successfully to:', subscription.endpoint.slice(0, 50) + '...');
    return true;
  } catch (error) {
    // Handle specific web-push errors
    if (error instanceof Error) {
      const statusCode = (error as { statusCode?: number }).statusCode;

      // 404 or 410 means the subscription is no longer valid
      if (statusCode === 404 || statusCode === 410) {
        console.log('Subscription expired or invalid:', subscription.id);
        // The subscription should be marked as inactive in the database
        // This will be handled by the caller
      } else {
        console.error('Failed to send push:', error.message);
      }
    } else {
      console.error('Failed to send push:', error);
    }
    return false;
  }
}

serve(async (req) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // First, clean up any stale 'processing' items (e.g., from crashed function runs)
    // Items stuck in 'processing' for more than 5 minutes are considered stale
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from('notification_queue')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('updated_at', staleThreshold);

    // Fetch pending notifications ready to send
    const now = new Date().toISOString();
    const { data: queue, error: queueError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('created_at', { ascending: true })
      .limit(100);

    if (queueError) {
      console.error('Failed to fetch queue:', queueError);
      return new Response(JSON.stringify({ error: queueError.message }), {
        status: 500,
        headers,
      });
    }

    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No pending notifications' }), {
        headers,
      });
    }

    const queueItems = queue as QueueItem[];

    // Batch fetch: Get unique recipient user IDs
    const recipientIds = [...new Set(queueItems.map((item) => item.recipient_user_id))];

    // Batch fetch all preferences for these users (single query instead of N queries)
    const { data: allPrefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', recipientIds);

    // Create a map for quick lookup
    const prefsMap = new Map<string, NotificationPreferences>();
    if (allPrefs) {
      for (const pref of allPrefs) {
        prefsMap.set(pref.user_id, pref as NotificationPreferences);
      }
    }

    // Batch fetch all active subscriptions for these users (single query instead of N queries)
    const { data: allSubscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds)
      .eq('active', true);

    // Create a map of user_id -> subscriptions[]
    const subscriptionsMap = new Map<string, PushSubscription[]>();
    if (allSubscriptions) {
      for (const sub of allSubscriptions as PushSubscription[]) {
        const existing = subscriptionsMap.get(sub.user_id) || [];
        existing.push(sub);
        subscriptionsMap.set(sub.user_id, existing);
      }
    }

    const results: { id: string; status: string; error?: string }[] = [];
    const inboxInserts: Array<{
      recipient_user_id: string;
      type: string;
      title: string;
      body: string;
      event_id: string | null;
      participant_id: string | null;
      actor_user_id: string | null;
      action_url: string | null;
    }> = [];

    // Process each queue item using the pre-fetched data
    for (const item of queueItems) {
      try {
        // Atomically mark as processing and increment attempts in a single operation
        // This prevents race conditions where items get stuck in 'processing' with wrong attempt counts
        await supabase
          .from('notification_queue')
          .update({
            status: 'processing',
            attempts: item.attempts + 1,
          })
          .eq('id', item.id);

        // Check user preferences from the pre-fetched map
        const prefs = prefsMap.get(item.recipient_user_id) || null;

        // Check if user wants this notification
        if (!shouldSendNotification(prefs, item.notification_type)) {
          await supabase
            .from('notification_queue')
            .update({
              status: 'skipped',
              processed_at: new Date().toISOString(),
              last_error: 'User preferences',
            })
            .eq('id', item.id);

          results.push({ id: item.id, status: 'skipped' });
          continue;
        }

        // Get user's subscriptions from the pre-fetched map
        const subscriptions = subscriptionsMap.get(item.recipient_user_id) || [];

        if (subscriptions.length === 0) {
          // No active subscriptions, skip but still save to inbox
          await supabase
            .from('notification_queue')
            .update({
              status: 'skipped',
              processed_at: new Date().toISOString(),
              last_error: 'No active push subscriptions',
            })
            .eq('id', item.id);
        } else {
          // Send to all active subscriptions
          const pushPayload = {
            title: item.title,
            body: item.body,
            data: {
              type: item.notification_type,
              url: item.action_url,
              event_id: item.event_id,
            },
          };

          let sentToAny = false;
          for (const sub of subscriptions) {
            const sent = await sendWebPush(sub, pushPayload);
            if (sent) sentToAny = true;
          }

          // Mark as sent
          await supabase
            .from('notification_queue')
            .update({
              status: sentToAny ? 'sent' : 'skipped',
              processed_at: new Date().toISOString(),
              last_error: sentToAny ? null : 'Push delivery failed',
            })
            .eq('id', item.id);
        }

        // Queue inbox insert for batch processing
        inboxInserts.push({
          recipient_user_id: item.recipient_user_id,
          type: item.notification_type,
          title: item.title,
          body: item.body,
          event_id: item.event_id,
          participant_id: item.participant_id,
          actor_user_id: item.actor_user_id,
          action_url: item.action_url,
        });

        results.push({ id: item.id, status: 'sent' });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process item ${item.id}:`, error);

        // Retry or fail based on attempts
        const newStatus = item.attempts >= 3 ? 'failed' : 'pending';
        await supabase
          .from('notification_queue')
          .update({
            status: newStatus,
            last_error: errorMessage,
          })
          .eq('id', item.id);

        results.push({ id: item.id, status: 'error', error: errorMessage });
      }
    }

    // Batch insert all inbox notifications
    if (inboxInserts.length > 0) {
      await supabase.from('notifications').insert(inboxInserts);
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal error',
      }),
      { status: 500, headers }
    );
  }
});
