import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Initialize Supabase client for test database
// You'll need to set these environment variables for your test database
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.TEST_SUPABASE_URL || '';
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.TEST_SUPABASE_ANON_KEY || '';

// Service role key for test fixtures (bypasses RLS for setup)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let _testDb: SupabaseClient<Database> | null = null;
let _testAdminDb: SupabaseClient<Database> | null = null;

/**
 * Get test database client (lazy initialization)
 * Uses anon key - respects RLS
 */
export function getTestDb(): SupabaseClient<Database> {
  if (!_testDb) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase credentials not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
      );
    }
    _testDb = createClient<Database>(supabaseUrl, supabaseKey);
  }
  return _testDb;
}

/**
 * Get admin database client for test setup (lazy initialization)
 * Uses service role key - bypasses RLS
 */
export function getAdminDb(): SupabaseClient<Database> {
  if (!_testAdminDb) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Supabase service role key not found. Set SUPABASE_SERVICE_ROLE_KEY environment variable.'
      );
    }
    _testAdminDb = createClient<Database>(supabaseUrl, supabaseServiceKey);
  }
  return _testAdminDb;
}

// Legacy export for backward compatibility
export const testDb = {
  get auth() {
    return getTestDb().auth;
  },
  from(table: string) {
    return getTestDb().from(table);
  },
};

/**
 * Generate unique test email to avoid conflicts
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@e2etest.local`;
}

/**
 * Generate unique test name
 */
export function generateTestName(prefix = 'Test'): string {
  const timestamp = Date.now();
  return `${prefix} ${timestamp}`;
}

/**
 * Create a test user in the database
 * Note: This requires Supabase service role key for full access
 */
export async function createTestUser(email: string, password: string) {
  const { data, error } = await testDb.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data;
}

/**
 * Delete a test user
 * Note: Deleting users requires service role access
 * For now, we'll just sign out and let cleanup happen via database triggers
 */
export async function deleteTestUser() {
  await testDb.auth.signOut();
}

/**
 * Create a test event
 * Uses admin client to bypass RLS
 */
export async function createTestEvent(
  organizerId: string,
  eventData?: Partial<{
    name: string;
    description: string;
    datetime: string;
    location: string;
    is_private: boolean;
    custom_fields: unknown[];
    max_participants: number | null;
    group_id: string | null;
  }>
) {
  const { data, error } = await getAdminDb()
    .from('events')
    .insert({
      organizer_id: organizerId,
      name: eventData?.name || generateTestName('Event'),
      description: eventData?.description || 'Test event description',
      datetime: eventData?.datetime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: eventData?.location || 'Test Location',
      is_private: eventData?.is_private ?? false,
      custom_fields: eventData?.custom_fields || [],
      max_participants: eventData?.max_participants || null,
      group_id: eventData?.group_id || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test event: ${error.message}`);
  }

  return data;
}

/**
 * Delete a test event
 */
export async function deleteTestEvent(eventId: string) {
  const { error } = await testDb.from('events').delete().eq('id', eventId);

  if (error) {
    throw new Error(`Failed to delete test event: ${error.message}`);
  }
}

/**
 * Create a test group
 * Uses admin client to bypass RLS
 */
export async function createTestGroup(
  organizerId: string,
  groupData?: Partial<{
    name: string;
    description: string;
  }>
) {
  const { data, error } = await getAdminDb()
    .from('groups')
    .insert({
      organizer_id: organizerId,
      name: groupData?.name || generateTestName('Group'),
      description: groupData?.description || 'Test group description',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test group: ${error.message}`);
  }

  return data;
}

/**
 * Delete a test group
 */
export async function deleteTestGroup(groupId: string) {
  const { error } = await testDb.from('groups').delete().eq('id', groupId);

  if (error) {
    throw new Error(`Failed to delete test group: ${error.message}`);
  }
}

/**
 * Create a test participant
 */
export async function createTestParticipant(
  eventId: string,
  participantData?: Partial<{
    name: string;
    email: string;
    user_id: string | null;
    responses: Record<string, unknown>;
  }>
) {
  const { data, error } = await testDb
    .from('participants')
    .insert({
      event_id: eventId,
      name: participantData?.name || generateTestName('Participant'),
      email: participantData?.email || generateTestEmail('participant'),
      user_id: participantData?.user_id || null,
      responses: participantData?.responses || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test participant: ${error.message}`);
  }

  return data;
}

/**
 * Enable a feature flag for a specific user
 * Uses admin client to bypass RLS
 */
export async function enableFeatureFlagForUser(userId: string, flagKey: string) {
  const { error } = await getAdminDb().from('feature_flag_overrides').upsert(
    {
      feature_flag_key: flagKey,
      user_id: userId,
      enabled: true,
    },
    {
      onConflict: 'feature_flag_key,user_id',
    }
  );

  if (error) {
    throw new Error(`Failed to enable feature flag ${flagKey}: ${error.message}`);
  }
}

/**
 * Disable a feature flag override for a specific user
 * Uses admin client to bypass RLS
 */
export async function disableFeatureFlagForUser(userId: string, flagKey: string) {
  await getAdminDb()
    .from('feature_flag_overrides')
    .delete()
    .eq('feature_flag_key', flagKey)
    .eq('user_id', userId);
}

/**
 * Clean up all test data created in a test
 * Pass arrays of IDs to delete
 */
export async function cleanupTestData(data: {
  eventIds?: string[];
  groupIds?: string[];
  participantIds?: string[];
}) {
  const errors: Error[] = [];

  // Delete in reverse order of dependencies
  if (data.participantIds?.length) {
    const { error } = await testDb
      .from('participants')
      .delete()
      .in('id', data.participantIds);
    if (error) errors.push(new Error(`Participant cleanup failed: ${error.message}`));
  }

  if (data.eventIds?.length) {
    const { error } = await testDb.from('events').delete().in('id', data.eventIds);
    if (error) errors.push(new Error(`Event cleanup failed: ${error.message}`));
  }

  if (data.groupIds?.length) {
    const { error } = await testDb.from('groups').delete().in('id', data.groupIds);
    if (error) errors.push(new Error(`Group cleanup failed: ${error.message}`));
  }

  if (errors.length > 0) {
    console.error('Cleanup errors:', errors);
  }
}
