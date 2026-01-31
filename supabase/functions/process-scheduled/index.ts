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

        // Check if we already sent a reminder for this participant
        const { data: existing } = await supabase
          .from('notification_queue')
          .select('id')
          .eq('participant_id', participant.id)
          .eq('notification_type', 'payment_reminder')
          .maybeSingle();

        if (existing) continue;

        // Also check notifications table (in case it was already processed)
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('participant_id', participant.id)
          .eq('type', 'payment_reminder')
          .maybeSingle();

        if (existingNotif) continue;

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
