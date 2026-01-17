-- Remove participant_id and guest_email from group_participants
-- Simplify group membership: groups are for authenticated users only

-- Drop the policy that depends on participant_id
DROP POLICY IF EXISTS "Users can read group overrides" ON public.feature_flag_overrides;

-- Drop foreign key constraint on participant_id
ALTER TABLE "public"."group_participants"
  DROP CONSTRAINT IF EXISTS "group_participants_participant_id_fkey";

-- Drop the index on participant_id
DROP INDEX IF EXISTS "public"."idx_group_participants_participant_id";

-- Drop the index on guest_email
DROP INDEX IF EXISTS "public"."idx_group_participants_guest_email";

-- Drop the unique constraint on group_id + guest_email
ALTER TABLE "public"."group_participants"
  DROP CONSTRAINT IF EXISTS "group_participants_group_id_guest_email_key";

-- Drop the identity check constraint (it checked user_id OR guest_email)
ALTER TABLE "public"."group_participants"
  DROP CONSTRAINT IF EXISTS "group_participants_identity_check";

-- Drop the columns
ALTER TABLE "public"."group_participants"
  DROP COLUMN IF EXISTS "participant_id";

ALTER TABLE "public"."group_participants"
  DROP COLUMN IF EXISTS "guest_email";

-- Make user_id NOT NULL since it's now the only way to identify a member
ALTER TABLE "public"."group_participants"
  ALTER COLUMN "user_id" SET NOT NULL;

-- Update comment
COMMENT ON TABLE "public"."group_participants" IS 'Group membership for authenticated users. Users can join groups via invite links and participate in group events.';

-- Drop the trigger that references participant_id
DROP TRIGGER IF EXISTS "auto_add_participant_to_group_trigger" ON "public"."participants";
DROP FUNCTION IF EXISTS "public"."auto_add_participant_to_group"();

-- Drop RPC functions that reference participant_id (no longer used)
DROP FUNCTION IF EXISTS "public"."add_participants_to_group"(TEXT, TEXT[]);
DROP FUNCTION IF EXISTS "public"."remove_participants_from_group"(TEXT, TEXT[]);

-- Recreate the policy using user_id instead of participant_id
CREATE POLICY "Users can read group overrides"
    ON public.feature_flag_overrides
    FOR SELECT
    TO authenticated
    USING (
        group_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.group_participants
            WHERE group_participants.group_id = feature_flag_overrides.group_id
            AND group_participants.user_id = auth.uid()
        )
    );
