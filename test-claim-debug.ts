import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testClaim() {
  console.log('Testing claim functionality...\n');

  // Create test event
  const testEvent = await supabase
    .from('events')
    .insert({
      organizer_id: '00000000-0000-0000-0000-000000000000', // Placeholder
      name: 'Test Claim Event',
      max_participants: 10,
    })
    .select()
    .single();

  if (testEvent.error) {
    console.error('Failed to create event:', testEvent.error);
    return;
  }

  console.log('Created event:', testEvent.data.id);

  // Try to insert a claimed participant directly
  const claimedParticipant = await supabase
    .from('participants')
    .insert({
      event_id: testEvent.data.id,
      name: 'Test Guest',
      user_id: null,
      claimed_by_user_id: '00000000-0000-0000-0000-000000000001',
      responses: {},
    })
    .select()
    .single();

  console.log('\nClaimed participant insert result:');
  console.log('Data:', claimedParticipant.data);
  console.log('Error:', claimedParticipant.error);

  // Check RLS policies
  console.log('\nChecking RLS policies on participants table...');
  const policies = await supabase.rpc('pg_policies');
  console.log(policies);

  // Cleanup
  await supabase.from('events').delete().eq('id', testEvent.data.id);
}

testClaim().catch(console.error);
