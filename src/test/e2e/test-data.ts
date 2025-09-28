// Mock Supabase for E2E tests
const mockSupabase = {
  from: (table: string) => ({
    insert: (data: any) => Promise.resolve({ error: null }),
    delete: () => ({
      in: (column: string, values: any[]) => Promise.resolve({ error: null }),
    }),
  }),
};

export interface TestEvent {
  id: string;
  name: string;
  description: string | null;
  datetime: string | null;
  location: string | null;
  max_participants: number | null;
  organizer_id: string;
  is_private: boolean;
  custom_fields: any[];
}

export interface TestParticipant {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  responses: Record<string, any>;
  user_id: string | null;
  slot_number: number;
  created_at: string;
}

export const testEvents: TestEvent[] = [
  {
    id: 'test-event-1',
    name: 'Test Event for E2E',
    description: 'This is a test event for end-to-end testing',
    datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'Test Location',
    max_participants: 10,
    organizer_id: 'test-organizer-1',
    is_private: false,
    custom_fields: [
      {
        id: 'field-1',
        label: 'Dietary Restrictions',
        type: 'text',
        required: false,
      },
    ],
  },
  {
    id: 'test-event-2',
    name: 'Private Test Event',
    description: 'A private event for testing access controls',
    datetime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'Private Location',
    max_participants: 5,
    organizer_id: 'test-organizer-1',
    is_private: true,
    custom_fields: [],
  },
];

export const testParticipants: TestParticipant[] = [
  {
    id: 'test-participant-1',
    event_id: 'test-event-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    notes: 'Looking forward to the event',
    responses: { 'field-1': 'No restrictions' },
    user_id: 'test-user-1',
    slot_number: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'test-participant-2',
    event_id: 'test-event-1',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: null,
    notes: null,
    responses: { 'field-1': 'Vegetarian' },
    user_id: 'test-user-2',
    slot_number: 2,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

export async function seedTestData() {
  console.log('Seeding test data...');

  try {
    // Mock seeding for E2E tests
    // In a real implementation, you would seed actual test data to your test database
    console.log('Mock seeding complete');
    return true;
  } catch (error) {
    console.error('Error seeding test data:', error);
    return false;
  }
}

export async function cleanupTestData() {
  console.log('Cleaning up test data...');

  try {
    // Mock cleanup for E2E tests
    console.log('Mock cleanup complete');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}
