import type { Group } from '@/services/groupService';

export const mockGroup: Group = {
  id: 'test-group',
  organizer_id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Group',
  description: 'A test group for unit testing',
  is_private: false,
  created_at: '2024-01-01T00:00:00Z',
  event_count: 3,
  participant_count: 5,
};

export const mockPrivateGroup: Group = {
  ...mockGroup,
  id: 'private-group',
  name: 'Private Test Group',
  is_private: true,
};

export const mockGroupsList: Group[] = [
  mockGroup,
  {
    ...mockGroup,
    id: 'group-2',
    name: 'Another Group',
    description: 'Another test group',
    event_count: 1,
    participant_count: 10,
  },
  {
    ...mockGroup,
    id: 'group-3',
    name: 'Third Group',
    description: null,
    event_count: 0,
    participant_count: 0,
  },
];
