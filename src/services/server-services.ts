// Mock data for testing when environment variables aren't available
const mockEvent = {
  id: 'test-event',
  name: 'Sample Badminton Event',
  datetime: '2024-01-15T18:00:00Z',
  location: 'Tiger Badminton Center',
  cost: '$16/person',
  description: 'Join us for a fun badminton session!',
};

const mockGroup = {
  id: 'test-group',
  name: 'HSD Badminton Group',
  description: 'Weekly badminton games for all skill levels',
  participant_count: 47,
  event_count: 12,
  created_at: '2024-01-01T00:00:00Z',
};

// Check if environment variables are available
const hasEnvVars = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY;

let supabaseServer = null;
if (hasEnvVars) {
  try {
    const { supabaseServer: ss } = await import('../lib/supabase-server.js');
    supabaseServer = ss;
  } catch {
    console.warn('Supabase server client not available, using mock data');
  }
}

// Server-side event service for OG image generation
export const serverEventService = {
  async getEventById(eventId: string) {
    if (!supabaseServer) {
      console.log('Using mock event data for OG image generation');
      return { ...mockEvent, id: eventId };
    }

    try {
      const { data, error } = await supabaseServer
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch event: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.warn('Failed to fetch real event data, using mock data:', error);
      return { ...mockEvent, id: eventId };
    }
  },
};

// Server-side group service for OG image generation
export const serverGroupService = {
  async getGroupById(groupId: string) {
    if (!supabaseServer) {
      console.log('Using mock group data for OG image generation');
      return { ...mockGroup, id: groupId };
    }

    try {
      const { data, error } = await supabaseServer
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch group: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.warn('Failed to fetch real group data, using mock data:', error);
      return { ...mockGroup, id: groupId };
    }
  },
};
