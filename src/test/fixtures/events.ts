import type { Event } from '@/services/eventService';
import type { Participant } from '@/services/participantService';
import type { Label } from '@/services/labelService';
import type { Organizer } from '@/services/organizerService';

export const mockOrganizer: Organizer = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'John Organizer',
  email: 'john@organizer.com',
  created_at: '2024-01-01T00:00:00Z',
};

export const mockEvent: Event = {
  id: 'V1StGXR8_Z', // Using nanoid format
  organizer_id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Event',
  description: 'A test event description',
  datetime: '2024-12-01T14:00:00Z',
  end_datetime: '2024-12-01T16:00:00Z',
  location: 'Test Location',
  is_paid: true,
  is_private: false,
  custom_fields: [
    {
      id: 'field-1',
      label: 'Dietary Restrictions',
      type: 'text',
      required: false,
    },
  ],
  created_at: '2024-01-01T00:00:00Z',
  parent_event_id: null,
  group_id: null,
  max_participants: 50,
  cost_breakdown: null,
  participant_count: 1,
};

export const mockEventsList: Event[] = [
  mockEvent,
  {
    ...mockEvent,
    id: 'K1LoGXR8_A', // 10-character nanoid format
    name: 'Another Event',
    end_datetime: '2024-12-01T18:00:00Z',
    participant_count: 0,
  },
  {
    ...mockEvent,
    id: 'M2JhGXR8_B', // 10-character nanoid format
    name: 'Third Event',
    end_datetime: null,
    is_private: true,
    participant_count: 0,
  },
];

export const mockParticipant: Participant = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  event_id: 'V1StGXR8_Z', // Using nanoid format for event reference
  name: 'John Doe',
  email: 'john@example.com',
  phone: '555-1234',
  notes: 'Test notes',
  user_id: null,
  claimed_by_user_id: null,
  responses: {
    'Dietary Restrictions': 'Vegetarian',
  },
  created_at: '2024-01-01T00:00:00Z',
  labels: [],
  payment_status: 'pending',
  payment_marked_at: null,
  payment_notes: null,
};

export const mockParticipantsList: Participant[] = [
  mockParticipant,
  {
    ...mockParticipant,
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'Jane Doe',
    email: 'jane@example.com',
    created_at: '2024-01-01T00:01:00Z',
    labels: [],
  },
  {
    ...mockParticipant,
    id: '550e8400-e29b-41d4-a716-446655440012',
    name: 'Bob Smith',
    email: 'bob@example.com',
    created_at: '2024-01-01T00:02:00Z',
    labels: [],
  },
];

export const mockLabel: Label = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  event_id: 'V1StGXR8_Z', // 10-character nanoid format for event reference
  name: 'VIP',
  color: '#gold',
};
