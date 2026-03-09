-- Drop the auto-remove trigger so that withdrawing from an event
-- does NOT remove the user from the group.
-- Group membership should be independent of event participation.

DROP TRIGGER IF EXISTS "auto_remove_participant_from_group_trigger" ON "public"."participants";
DROP FUNCTION IF EXISTS "public"."auto_remove_participant_from_group"();
