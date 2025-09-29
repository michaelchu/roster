import type { Group, GroupParticipant } from '@/services/groupService';
import { mockEvent, mockParticipant } from './events';

export const mockGroup: Group = {
  id: 'group-123',
  organizer_id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Group',
  description: 'A test group for events',
  created_at: '2024-01-01T00:00:00Z',
  event_count: 2,
  participant_count: 5,
};

export const mockGroupsList: Group[] = [
  mockGroup,
  {
    id: 'group-456',
    organizer_id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Another Group',
    description: 'Another test group',
    created_at: '2024-01-02T00:00:00Z',
    event_count: 1,
    participant_count: 3,
  },
  {
    id: 'group-789',
    organizer_id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Empty Group',
    description: 'A group with no events',
    created_at: '2024-01-03T00:00:00Z',
    event_count: 0,
    participant_count: 0,
  },
];

export const mockGroupParticipant: GroupParticipant = {
  ...mockParticipant,
  event: {
    id: mockEvent.id,
    name: mockEvent.name,
  },
  group_joined_at: '2024-01-01T00:00:00Z',
};

export const mockGroupParticipantsList: GroupParticipant[] = [
  mockGroupParticipant,
  {
    ...mockParticipant,
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'Jane Doe',
    email: 'jane@example.com',
    event: {
      id: 'event-2',
      name: 'Second Event',
    },
    group_joined_at: '2024-01-02T00:00:00Z',
  },
];
