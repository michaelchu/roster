/**
 * Process Scheduled Notifications Edge Function
 *
 * Handles time-based notifications like payment reminders (24hr after event).
 * Should be triggered by a cron job (e.g., every hour).
 *
 * Can be set up in Supabase Dashboard:
 * - Go to Database > Webhooks
 * - Or use pg_cron if available
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const now = new Date();
    let queued = 0;

    // =========================================================================
    // Payment Reminders (24 hours after event ends)
    // =========================================================================
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);

    // Find events that ended between 24-25 hours ago with unpaid participants
    const { data: unpaidParticipants, error: participantsError } = await supabase
      .from('participants')
      .select(
        `
        id,
        name,
        user_id,
        claimed_by_user_id,
        event_id,
        events!inner (
          id,
          name,
          datetime,
          end_datetime
        )
      `
      )
      .eq('payment_status', 'pending')
      .not('user_id', 'is', null);

    if (participantsError) {
      console.error('Failed to fetch unpaid participants:', participantsError);
    } else if (unpaidParticipants) {
      for (const participant of unpaidParticipants) {
        // Get event end time (fall back to datetime if no end_datetime)
        const event = participant.events as { id: string; name: string; datetime: string; end_datetime: string | null };
        const eventEndTime = event.end_datetime || event.datetime;

        if (!eventEndTime) continue;

        const endDate = new Date(eventEndTime);

        // Check if event ended between 24-25 hours ago
        if (endDate < twentyFiveHoursAgo || endDate > twentyFourHoursAgo) {
          continue;
        }

        const userId = participant.user_id || participant.claimed_by_user_id;
        if (!userId) continue;

        // --------------------------------------------------------------------
        // Batch-load existing payment reminders for all relevant participants
        // --------------------------------------------------------------------
        // Assumes the surrounding scope provides an array of participants
        // (e.g., unpaid participants for this event) named `unpaidParticipants`.
        // If the actual variable name differs, adjust the mapping below.
        if (typeof queuedReminderParticipantIds === 'undefined' || typeof sentReminderParticipantIds === 'undefined') {
          // Collect all participant IDs in the current batch
          const participantIds = unpaidParticipants.map((p: { id: string }) => p.id);

          // Fetch existing queued payment reminders for these participants
          const { data: existingQueueReminders, error: existingQueueError } = await supabase
            .from('notification_queue')
            .select('participant_id')
            .in('participant_id', participantIds)
            .eq('notification_type', 'payment_reminder');

          if (existingQueueError) {
            console.error('Failed to fetch existing payment reminders from notification_queue:', existingQueueError);
          }

          // Fetch already-sent payment reminders from notifications table
          const { data: existingNotifications, error: existingNotificationsError } = await supabase
            .from('notifications')
            .select('participant_id')
            .in('participant_id', participantIds)
            .eq('type', 'payment_reminder');

          if (existingNotificationsError) {
            console.error('Failed to fetch existing payment reminders from notifications:', existingNotificationsError);
          }

          // Build lookup sets for quick membership tests inside the loop
          // @ts-ignore - declare on the fly for the current batch scope
          var queuedReminderParticipantIds = new Set(
            (existingQueueReminders ?? []).map((row: { participant_id: string }) => row.participant_id),
          );
          // @ts-ignore - declare on the fly for the current batch scope
          var sentReminderParticipantIds = new Set(
            (existingNotifications ?? []).map((row: { participant_id: string }) => row.participant_id),
          );
        }

        // Skip if a reminder is already queued for this participant
        if (queuedReminderParticipantIds.has(participant.id)) {
          continue;
        }

        // Also skip if a notification has already been sent for this participant
        if (sentReminderParticipantIds.has(participant.id)) {
          continue;
        }
        // Queue payment reminder
        const { error: insertError } = await supabase.from('notification_queue').insert({
          recipient_user_id: userId,
          notification_type: 'payment_reminder',
          title: 'Payment reminder',
          body: `Don't forget to pay for ${event.name}`,
          event_id: participant.event_id,
          participant_id: participant.id,
          action_url: `/events/${participant.event_id}`,
        });

        if (!insertError) {
          queued++;
        } else {
          console.error('Failed to queue payment reminder:', insertError);
        }
      }
    }

    // =========================================================================
    // Trigger send-push function to process the queue
    // =========================================================================
    if (queued > 0) {
      try {
        // Invoke the send-push function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to trigger send-push:', await response.text());
        }
      } catch (error) {
        console.error('Failed to invoke send-push:', error);
      }
    }

    return new Response(
      JSON.stringify({
        queued,
        message: queued > 0 ? `Queued ${queued} payment reminders` : 'No scheduled notifications to process',
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
