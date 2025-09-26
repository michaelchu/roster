import { Event } from '@/services/eventService';
import { Participant } from '@/services/participantService';
import { Label } from '@/services/labelService';
import { Organizer } from '@/services/organizerService';

export const mockOrganizer: Organizer = {
  id: 'org-123',
  name: 'John Organizer',
  created_at: '2024-01-01T00:00:00Z',
};

export const mockEvent: Event = {
  id: 'event-123',
  organizer_id: 'org-123',
  name: 'Test Event',
  description: 'This is a test event',
  datetime: '2024-12-25T18:00:00Z',
  location: 'Test Location',
  is_private: false,
  custom_fields: [
    {
      id: 'field-1',
      label: 'Dietary Preferences',
      type: 'text',
      required: false,
    },
  ],
  created_at: '2024-01-01T00:00:00Z',
  parent_event_id: null,
  participant_count: 5,
  max_participants: 100,
};

export const mockPrivateEvent: Event = {
  ...mockEvent,
  id: 'event-456',
  is_private: true,
};

export const mockLabel: Label = {
  id: 'label-123',
  event_id: 'event-123',
  name: 'VIP',
  color: '#FF0000',
};

export const mockParticipant: Participant = {
  id: 'participant-123',
  event_id: 'event-123',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1234567890',
  notes: 'Special requirements',
  user_id: 'user-123',
  responses: {
    'field-1': 'Vegetarian',
  },
  created_at: '2024-01-15T00:00:00Z',
  labels: [mockLabel],
};

export const mockEventsList: Event[] = [
  mockEvent,
  {
    ...mockEvent,
    id: 'event-789',
    name: 'Another Event',
    participant_count: 10,
  },
  {
    ...mockEvent,
    id: 'event-101',
    name: 'Third Event',
    participant_count: 0,
  },
];
