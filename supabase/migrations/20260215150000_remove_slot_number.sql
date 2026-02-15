-- Migration: Remove slot_number from participants
--
-- The slot_number column was a maintained positional field that required complex
-- trigger-based machinery (assignment, compaction, advisory locks). This caused
-- bugs with numbering gaps after deletions and race conditions.
--
-- Industry standard: order by registration time (created_at), derive display
-- numbers from array position. Organizer-first ordering is handled at the
-- application level.

-- ============================================================================
-- DROP SLOT COMPACTION TRIGGER + FUNCTION
-- ============================================================================

DROP TRIGGER IF EXISTS "compact_slots_after_participant_deletion" ON "public"."participants";
DROP FUNCTION IF EXISTS "public"."compact_slots_after_deletion"();

-- ============================================================================
-- DROP SLOT ASSIGNMENT TRIGGER + FUNCTION
-- ============================================================================

DROP TRIGGER IF EXISTS "assign_participant_slot_trigger" ON "public"."participants";
DROP FUNCTION IF EXISTS "public"."assign_participant_slot"();

-- ============================================================================
-- DROP get_next_slot_number RPC FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS "public"."get_next_slot_number"("p_event_id" "text", "p_user_id" "uuid");

-- ============================================================================
-- DROP UNIQUE CONSTRAINT AND INDEX
-- ============================================================================

ALTER TABLE "public"."participants" DROP CONSTRAINT IF EXISTS "participants_event_id_slot_key";
DROP INDEX IF EXISTS "idx_participants_slot_number";

-- ============================================================================
-- DROP THE COLUMN
-- ============================================================================

ALTER TABLE "public"."participants" DROP COLUMN IF EXISTS "slot_number";

-- ============================================================================
-- UPDATE COMMENT ON OWNERSHIP PROTECTION TRIGGER
-- ============================================================================

COMMENT ON FUNCTION "public"."prevent_participant_ownership_change"()
IS 'Prevents modification of ownership and identity columns on participants. Organizers can only update info fields like name, email, phone, notes, responses, and payment fields.';
