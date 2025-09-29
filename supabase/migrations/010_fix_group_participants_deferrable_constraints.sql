-- Fix deferrable constraints on group_participants table
-- ON CONFLICT does not support deferrable unique constraints in PostgreSQL

-- Drop the existing deferrable constraints
ALTER TABLE group_participants DROP CONSTRAINT IF EXISTS group_participants_group_id_user_id_key;
ALTER TABLE group_participants DROP CONSTRAINT IF EXISTS group_participants_group_id_guest_email_key;

-- Recreate them as non-deferrable constraints
ALTER TABLE group_participants ADD CONSTRAINT group_participants_group_id_user_id_key
    UNIQUE(group_id, user_id);

ALTER TABLE group_participants ADD CONSTRAINT group_participants_group_id_guest_email_key
    UNIQUE(group_id, guest_email);