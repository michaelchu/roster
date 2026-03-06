/**
 * Impersonate User Edge Function
 *
 * Allows platform admins (users with app_metadata.is_admin = true) to
 * generate a session for another user. This is useful for debugging and
 * support purposes.
 *
 * Request body: { user_id: string }
 * Returns: { session: { access_token, refresh_token, expires_in, user } }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    // Extract the caller's JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers,
      });
    }

    const callerToken = authHeader.replace('Bearer ', '');

    // Create a client with the caller's token to verify their identity
    const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser(callerToken);

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid authorization token' }), {
        status: 401,
        headers,
      });
    }

    // Check if the caller is a platform admin
    if (!caller.app_metadata?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403,
        headers,
      });
    }

    // Parse the request body
    const { user_id } = await req.json();
    if (!user_id || typeof user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid user_id' }), {
        status: 400,
        headers,
      });
    }

    // Prevent impersonating yourself
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'Cannot impersonate yourself' }), {
        status: 400,
        headers,
      });
    }

    // Use service role client to generate a magic link for the target user
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the target user exists
    const {
      data: { user: targetUser },
      error: targetError,
    } = await adminClient.auth.admin.getUserById(user_id);

    if (targetError || !targetUser) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404,
        headers,
      });
    }

    // Generate a magic link to get session properties
    const {
      data: { properties },
      error: linkError,
    } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email!,
    });

    if (linkError || !properties?.hashed_token) {
      console.error('Failed to generate link:', linkError);
      return new Response(JSON.stringify({ error: 'Failed to generate impersonation session' }), {
        status: 500,
        headers,
      });
    }

    // Verify the OTP to get a real session
    const {
      data: { session },
      error: verifyError,
    } = await adminClient.auth.verifyOtp({
      token_hash: properties.hashed_token,
      type: 'magiclink',
    });

    if (verifyError || !session) {
      console.error('Failed to verify OTP:', verifyError);
      return new Response(JSON.stringify({ error: 'Failed to create impersonation session' }), {
        status: 500,
        headers,
      });
    }

    console.log(
      `Admin ${caller.email} (${caller.id}) impersonated user ${targetUser.email} (${targetUser.id})`
    );

    return new Response(
      JSON.stringify({
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          user: session.user,
        },
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Impersonation error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers,
    });
  }
});
