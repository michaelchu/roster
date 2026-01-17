-- Create function to get groups with event and member counts in a single query
-- This eliminates N+1 query problem in groupService.getGroupsByOrganizer

CREATE OR REPLACE FUNCTION public.get_groups_with_counts(p_organizer_id uuid)
RETURNS TABLE (
  id text,
  organizer_id uuid,
  name text,
  description text,
  created_at timestamptz,
  event_count bigint,
  participant_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    g.id,
    g.organizer_id,
    g.name,
    g.description,
    g.created_at,
    COALESCE(e.event_count, 0) AS event_count,
    COALESCE(gp.participant_count, 0) AS participant_count
  FROM groups g
  LEFT JOIN (
    SELECT group_id, COUNT(*) AS event_count
    FROM events
    GROUP BY group_id
  ) e ON e.group_id = g.id
  LEFT JOIN (
    SELECT group_id, COUNT(*) AS participant_count
    FROM group_participants
    GROUP BY group_id
  ) gp ON gp.group_id = g.id
  WHERE g.organizer_id = p_organizer_id
  ORDER BY g.created_at DESC;
$$;

-- Create function to get groups for a user (member) with counts
CREATE OR REPLACE FUNCTION public.get_user_groups_with_counts(p_user_id uuid)
RETURNS TABLE (
  id text,
  organizer_id uuid,
  name text,
  description text,
  created_at timestamptz,
  event_count bigint,
  participant_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    g.id,
    g.organizer_id,
    g.name,
    g.description,
    g.created_at,
    COALESCE(e.event_count, 0) AS event_count,
    COALESCE(gp_count.participant_count, 0) AS participant_count
  FROM group_participants gp
  INNER JOIN groups g ON g.id = gp.group_id
  LEFT JOIN (
    SELECT group_id, COUNT(*) AS event_count
    FROM events
    GROUP BY group_id
  ) e ON e.group_id = g.id
  LEFT JOIN (
    SELECT group_id, COUNT(*) AS participant_count
    FROM group_participants
    GROUP BY group_id
  ) gp_count ON gp_count.group_id = g.id
  WHERE gp.user_id = p_user_id
  ORDER BY g.created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_groups_with_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_groups_with_counts(uuid) TO authenticated;
