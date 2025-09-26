import type { Event } from '@/services/eventService';
import type { Participant } from '@/services/participantService';
import type { Label } from '@/services/labelService';
import type { Organizer } from '@/services/organizerService';

export const mockOrganizer: Organizer = {
  id: 'org-123',
  name: 'John Organizer',
  created_at: '2024-01-01T00:00:00Z',
};

export const mockEvent: Event = {
  id: 'event-123',
  organizer_id: 'org-123',
  name: 'Test Event',
  description: 'A test event description',
  datetime: '2024-12-01T14:00:00Z',
  location: 'Test Location',
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
  max_participants: 50,
  participant_count: 1,
};

export const mockEventsList: Event[] = [
  mockEvent,
  {
    ...mockEvent,
    id: 'event-456',
    name: 'Another Event',
    participant_count: 0,
  },
  {
    ...mockEvent,
    id: 'event-789',
    name: 'Third Event',
    is_private: true,
    participant_count: 0,
  },
];

export const mockParticipant: Participant = {
  id: 'participant-123',
  event_id: 'event-123',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '555-1234',
  notes: 'Test notes',
  user_id: null,
  responses: {
    'Dietary Restrictions': 'Vegetarian',
  },
  created_at: '2024-01-01T00:00:00Z',
  labels: [],
};

export const mockParticipantsList: Participant[] = [
  mockParticipant,
  {
    ...mockParticipant,
    id: 'participant-456',
    name: 'Jane Doe',
    email: 'jane@example.com',
    labels: [],
  },
  {
    ...mockParticipant,
    id: 'participant-789',
    name: 'Bob Smith',
    email: 'bob@example.com',
    labels: [],
  },
];

export const mockLabel: Label = {
  id: 'label-123',
  event_id: 'event-123',
  name: 'VIP',
  color: '#gold',
};
