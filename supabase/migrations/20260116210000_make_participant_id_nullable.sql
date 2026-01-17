-- Make participant_id nullable to allow direct group membership without event participation
-- This enables users to join groups via invite links without requiring them to sign up for events first

-- Drop the foreign key constraint
ALTER TABLE "public"."group_participants"
  DROP CONSTRAINT IF EXISTS "group_participants_participant_id_fkey";

-- Make participant_id nullable
ALTER TABLE "public"."group_participants"
  ALTER COLUMN "participant_id" DROP NOT NULL;

-- Re-add the foreign key constraint with ON DELETE CASCADE (only enforced when participant_id is not null)
ALTER TABLE "public"."group_participants"
  ADD CONSTRAINT "group_participants_participant_id_fkey"
  FOREIGN KEY ("participant_id")
  REFERENCES "public"."participants"("id")
  ON DELETE CASCADE;

-- Update comment to reflect new capability
COMMENT ON TABLE "public"."group_participants" IS 'Many-to-many relationship between groups and participants. Members can join groups directly via invite links or automatically when registering for group events.';
