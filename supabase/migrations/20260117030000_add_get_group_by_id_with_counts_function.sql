-- Create function to get a single group with event and member counts
-- Used by getGroupById to include counts in the response

CREATE OR REPLACE FUNCTION public.get_group_by_id_with_counts(p_group_id text)
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
    WHERE group_id = p_group_id
    GROUP BY group_id
  ) e ON e.group_id = g.id
  LEFT JOIN (
    SELECT group_id, COUNT(*) AS participant_count
    FROM group_participants
    WHERE group_id = p_group_id
    GROUP BY group_id
  ) gp ON gp.group_id = g.id
  WHERE g.id = p_group_id;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_group_by_id_with_counts(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_group_by_id_with_counts(text) TO authenticated;
