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

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
// VAPID_SUBJECT is used when implementing actual web-push (see sendWebPush comments)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@roster.app';

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
 * Send a Web Push notification
 * Note: This is a simplified implementation. For production, use a proper
 * web-push library or service like Firebase Cloud Messaging.
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
    // In a production environment, you would:
    // 1. Import the web-push library or use a native implementation
    // 2. Sign the request with VAPID keys
    // 3. Encrypt the payload with the subscription keys
    // 4. Send to the push service endpoint

    // For now, log the notification that would be sent
    console.log('Would send push to:', subscription.endpoint);
    console.log('Payload:', JSON.stringify(payload));

    // Simulate sending (in production, replace with actual web-push implementation)
    // The actual implementation would look something like:
    //
    // const webpush = await import('npm:web-push');
    // webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    // await webpush.sendNotification({
    //   endpoint: subscription.endpoint,
    //   keys: {
    //     p256dh: subscription.p256dh_key,
    //     auth: subscription.auth_key,
    //   }
    // }, JSON.stringify(payload));

    return true;
  } catch (error) {
    console.error('Failed to send push:', error);
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

    const results: { id: string; status: string; error?: string }[] = [];

    for (const item of queue as QueueItem[]) {
      // Mark as processing
      await supabase
        .from('notification_queue')
        .update({
          status: 'processing',
          attempts: item.attempts + 1,
        })
        .eq('id', item.id);

      try {
        // Check user preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', item.recipient_user_id)
          .single();

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

        // Get user's active push subscriptions
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', item.recipient_user_id)
          .eq('active', true);

        if (!subscriptions || subscriptions.length === 0) {
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
          for (const sub of subscriptions as PushSubscription[]) {
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

        // Always save to notifications inbox for history
        await supabase.from('notifications').insert({
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
