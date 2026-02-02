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
    // Define the maximum number of attempts allowed for a notification
    const MAX_ATTEMPTS = 3;

    // Mark stale items that have already reached the maximum attempts as failed
    const { error: staleFailError } = await supabase
      .from('notification_queue')
      .update({ status: 'failed' })
      .eq('status', 'processing')
      .gte('attempts', MAX_ATTEMPTS)
      .lt('updated_at', staleThreshold);

    if (staleFailError) {
      console.error('Failed to mark over-attempted stale items as failed:', staleFailError);
      // Continue anyway - this is not critical enough to abort the entire function
    }

    // Reset remaining stale processing items (that have not exhausted attempts) back to pending
    const { error: cleanupError } = await supabase
      .from('notification_queue')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('updated_at', staleThreshold)
      .lt('attempts', MAX_ATTEMPTS);
    
    if (cleanupError) {
      console.error('Failed to clean up stale items:', cleanupError);
      // Continue anyway - this is not critical enough to abort the entire function
    }

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
      let claimedItem: QueueItem | null = null;
      try {
        // Atomically claim this item by marking as processing and incrementing attempts
        // Use conditional update to prevent race conditions with concurrent function instances
        // Only update if status is still 'pending' (optimistic locking)
        const { data: updated, error: updateError } = await supabase
          .from('notification_queue')
          .update({
            status: 'processing',
            attempts: item.attempts + 1,
          })
          .eq('id', item.id)
          .eq('status', 'pending') // Only update if still pending
          .select()
          .single();

        // Distinguish between "no row updated" (claimed elsewhere) and real errors
        if (updateError) {
          if ((updateError as { code?: string }).code === 'PGRST116') {
            // No rows returned: another instance likely claimed this item first
            console.log(`Item ${item.id} already claimed by another instance, skipping`);
          } else {
            // Genuine error when trying to claim the item
            console.error(
              `Failed to claim item ${item.id} from notification_queue:`,
              updateError,
            );
          }
          continue;
        }

        if (!updated) {
          // No data returned without an explicit error: treat as not claimed
          console.log(
            `Item ${item.id} was not updated (no data returned), likely claimed by another instance, skipping`,
          );
          continue;
        }

        // Use the updated item with current attempts count from database
        const currentItem = updated as QueueItem;
        claimedItem = currentItem;

        // Check user preferences from the pre-fetched map
        const prefs = prefsMap.get(currentItem.recipient_user_id) || null;

        // Check if user wants this notification
        if (!shouldSendNotification(prefs, currentItem.notification_type)) {
          await supabase
            .from('notification_queue')
            .update({
              status: 'skipped',
              processed_at: new Date().toISOString(),
              last_error: 'User preferences',
            })
            .eq('id', currentItem.id);

          results.push({ id: currentItem.id, status: 'skipped' });
          continue;
        }

        // Get user's subscriptions from the pre-fetched map
        const subscriptions = subscriptionsMap.get(currentItem.recipient_user_id) || [];

        if (subscriptions.length === 0) {
          // No active subscriptions, skip but still save to inbox
          await supabase
            .from('notification_queue')
            .update({
              status: 'skipped',
              processed_at: new Date().toISOString(),
              last_error: 'No active push subscriptions',
            })
            .eq('id', currentItem.id);
        } else {
          // Send to all active subscriptions
          const pushPayload = {
            title: currentItem.title,
            body: currentItem.body,
            data: {
              type: currentItem.notification_type,
              url: currentItem.action_url,
              event_id: currentItem.event_id,
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
            .eq('id', currentItem.id);
        }

        // Queue inbox insert for batch processing
        inboxInserts.push({
          recipient_user_id: currentItem.recipient_user_id,
          type: currentItem.notification_type,
          title: currentItem.title,
          body: currentItem.body,
          event_id: currentItem.event_id,
          participant_id: currentItem.participant_id,
          actor_user_id: currentItem.actor_user_id,
          action_url: currentItem.action_url,
        });

        results.push({ id: currentItem.id, status: 'sent' });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const itemId = claimedItem?.id || item.id;
        console.error(`Failed to process item ${itemId}:`, error);

        // Retry or fail based on attempts
        // If we successfully claimed the item, use its attempts count; otherwise calculate from original
        const currentAttempts = claimedItem?.attempts || item.attempts + 1;
        const newStatus = currentAttempts >= 3 ? 'failed' : 'pending';
        await supabase
          .from('notification_queue')
          .update({
            status: newStatus,
            last_error: errorMessage,
          })
          .eq('id', itemId);

        results.push({ id: itemId, status: 'error', error: errorMessage });
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
