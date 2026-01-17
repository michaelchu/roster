-- Remove is_private column from groups table
ALTER TABLE groups DROP COLUMN IF EXISTS is_private;

-- Drop existing functions first (required when changing return type)
DROP FUNCTION IF EXISTS get_groups_with_counts(uuid);
DROP FUNCTION IF EXISTS get_group_by_id_with_counts(text);
DROP FUNCTION IF EXISTS get_user_groups_with_counts(uuid);

-- Recreate get_groups_with_counts function without is_private
CREATE FUNCTION get_groups_with_counts(p_organizer_id uuid)
RETURNS TABLE(
  id text,
  organizer_id uuid,
  name text,
  description text,
  created_at timestamptz,
  event_count bigint,
  participant_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    g.id,
    g.organizer_id,
    g.name,
    g.description,
    g.created_at,
    COUNT(DISTINCT e.id) as event_count,
    COUNT(DISTINCT gp.id) as participant_count
  FROM groups g
  LEFT JOIN events e ON e.group_id = g.id
  LEFT JOIN group_participants gp ON gp.group_id = g.id
  WHERE g.organizer_id = p_organizer_id
  GROUP BY g.id
  ORDER BY g.created_at DESC;
$$;

-- Recreate get_group_by_id_with_counts function without is_private
CREATE FUNCTION get_group_by_id_with_counts(p_group_id text)
RETURNS TABLE(
  id text,
  organizer_id uuid,
  name text,
  description text,
  created_at timestamptz,
  event_count bigint,
  participant_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    g.id,
    g.organizer_id,
    g.name,
    g.description,
    g.created_at,
    COUNT(DISTINCT e.id) as event_count,
    COUNT(DISTINCT gp.id) as participant_count
  FROM groups g
  LEFT JOIN events e ON e.group_id = g.id
  LEFT JOIN group_participants gp ON gp.group_id = g.id
  WHERE g.id = p_group_id
  GROUP BY g.id;
$$;

-- Recreate get_user_groups_with_counts function without is_private
CREATE FUNCTION get_user_groups_with_counts(p_user_id uuid)
RETURNS TABLE(
  id text,
  organizer_id uuid,
  name text,
  description text,
  created_at timestamptz,
  event_count bigint,
  participant_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    g.id,
    g.organizer_id,
    g.name,
    g.description,
    g.created_at,
    COUNT(DISTINCT e.id) as event_count,
    COUNT(DISTINCT gp2.id) as participant_count
  FROM groups g
  INNER JOIN group_participants gp ON gp.group_id = g.id AND gp.user_id = p_user_id
  LEFT JOIN events e ON e.group_id = g.id
  LEFT JOIN group_participants gp2 ON gp2.group_id = g.id
  GROUP BY g.id
  ORDER BY g.created_at DESC;
$$;
