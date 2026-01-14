


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_participants_to_group"("p_group_id" "text", "p_participant_ids" "text"[]) RETURNS TABLE("added_count" integer, "skipped_count" integer, "failed_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ 
                                      DECLARE 
                                           v_added_count INTEGER := 0; 
                                                v_skipped_count INTEGER := 0; 
                                                     v_failed_count INTEGER := 0; 
                                                          v_participant_id TEXT; 
                                                               v_user_id UUID; 
                                                                    v_email TEXT; 
                                                                     BEGIN 
                                                                          -- Verify user has permission (is owner or admin of the group) 
                                                                               IF NOT EXISTS ( 
                                                                                        SELECT 1 FROM groups 
                                                                                                 WHERE id = p_group_id 
                                                                                                          AND ( 
                                                                                                                       organizer_id = auth.uid() 
                                                                                                                                    OR EXISTS ( 
                                                                                                                                                     SELECT 1 FROM group_admins 
                                                                                                                                                                      WHERE group_id = p_group_id 
                                                                                                                                                                                       AND user_id = auth.uid() 
                                                                                                                                                                                                    ) 
                                                                                                                                                                                                             ) 
                                                                                                                                                                                                                  ) THEN 
                                                                                                                                                                                                                           RAISE EXCEPTION 'Unauthorized: User is not an admin of this group'; 
                                                                                                                                                                                                                                END IF; 
                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                       -- Process each participant in a single transaction 
                                                                                                                                                                                                                                            FOREACH v_participant_id IN ARRAY p_participant_ids 
                                                                                                                                                                                                                                                 LOOP 
                                                                                                                                                                                                                                                          BEGIN 
                                                                                                                                                                                                                                                                       -- Get participant's stable identifiers 
                                                                                                                                                                                                                                                                                    SELECT user_id, email INTO v_user_id, v_email 
                                                                                                                                                                                                                                                                                                 FROM participants 
                                                                                                                                                                                                                                                                                                              WHERE id = v_participant_id; 
                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                             IF NOT FOUND THEN 
                                                                                                                                                                                                                                                                                                                                              v_failed_count := v_failed_count + 1; 
                                                                                                                                                                                                                                                                                                                                                               CONTINUE; 
                                                                                                                                                                                                                                                                                                                                                                            END IF; 
                                                                                                                                                                                                                                                                                                                                                                              
                                                                                                                                                                                                                                                                                                                                                                                           -- Try to insert the participant into group_participants 
                                                                                                                                                                                                                                                                                                                                                                                                        INSERT INTO group_participants (group_id, participant_id, user_id, guest_email) 
                                                                                                                                                                                                                                                                                                                                                                                                                     VALUES ( 
                                                                                                                                                                                                                                                                                                                                                                                                                                      p_group_id, 
                                                                                                                                                                                                                                                                                                                                                                                                                                                       v_participant_id, 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                        v_user_id, 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         CASE WHEN v_user_id IS NULL THEN v_email ELSE NULL END 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      ); 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     v_added_count := v_added_count + 1; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                EXCEPTION 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             WHEN unique_violation THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              -- Participant already in group, skip silently 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               v_skipped_count := v_skipped_count + 1; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            WHEN OTHERS THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             -- Other errors 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              v_failed_count := v_failed_count + 1; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       END; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            END LOOP; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   RETURN QUERY SELECT v_added_count, v_skipped_count, v_failed_count; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    END; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     $$;


ALTER FUNCTION "public"."add_participants_to_group"("p_group_id" "text", "p_participant_ids" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_participants_to_group"("p_group_id" "text", "p_participant_ids" "text"[]) IS 'Atomically add multiple participants to a group. Only group owners and admins can execute. Returns counts of added, skipped (duplicates), and failed operations.';



CREATE OR REPLACE FUNCTION "public"."assign_participant_slot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    assigned_slot INTEGER;
BEGIN
    -- Only assign slot if it's not already set
    IF NEW.slot_number IS NULL THEN
        -- Get the next available slot number
        assigned_slot := get_next_slot_number(NEW.event_id, NEW.user_id);
        NEW.slot_number := assigned_slot;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_participant_slot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_add_participant_to_group"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             DECLARE 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  event_group_id TEXT; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   BEGIN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        -- Get the group_id for the event the participant just joined 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             SELECT group_id INTO event_group_id 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  FROM events 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       WHERE id = NEW.event_id; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              -- If the event belongs to a group, add the participant to that group using stable identifiers 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   IF event_group_id IS NOT NULL THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            -- Insert or update using stable identifiers (user_id for auth users, email for guests) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     IF NEW.user_id IS NOT NULL THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  -- Authenticated user: upsert on group_id + user_id 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               INSERT INTO group_participants (group_id, participant_id, user_id, joined_at) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            VALUES (event_group_id, NEW.id, NEW.user_id, NEW.created_at) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         ON CONFLICT (group_id, user_id) DO UPDATE SET 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          participant_id = NEW.id, -- Update to latest registration for traceability 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           joined_at = LEAST(group_participants.joined_at, NEW.created_at); -- Keep earliest join date 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ELSE 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 -- Guest user: upsert on group_id + guest_email 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              INSERT INTO group_participants (group_id, participant_id, guest_email, joined_at) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           VALUES (event_group_id, NEW.id, NEW.email, NEW.created_at) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        ON CONFLICT (group_id, guest_email) DO UPDATE SET 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         participant_id = NEW.id, -- Update to latest registration for traceability 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          joined_at = LEAST(group_participants.joined_at, NEW.created_at); -- Keep earliest join date 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               RETURN NEW; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                END; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 $$;


ALTER FUNCTION "public"."auto_add_participant_to_group"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_remove_participant_from_group"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           DECLARE 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                event_group_id TEXT; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     remaining_events_count INTEGER; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      BEGIN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           -- Get the group_id for the event the participant was removed from 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                SELECT group_id INTO event_group_id 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     FROM events 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          WHERE id = OLD.event_id; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 -- If the event belonged to a group, check if participant has other events in same group 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      IF event_group_id IS NOT NULL THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               SELECT COUNT(*) INTO remaining_events_count 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        FROM participants p 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 JOIN events e ON p.event_id = e.id 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          WHERE ( 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       -- Match by user_id if the participant was a registered user 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    (OLD.user_id IS NOT NULL AND p.user_id = OLD.user_id) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 OR 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              -- Match by email if the participant was a guest or for additional safety 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           (OLD.email IS NOT NULL AND p.email = OLD.email) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             AND e.group_id = event_group_id; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        -- If no more events in this group, remove from group using stable identifiers 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 IF remaining_events_count = 0 THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              IF OLD.user_id IS NOT NULL THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               -- Remove by user_id for authenticated users 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                DELETE FROM group_participants 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 WHERE group_id = event_group_id AND user_id = OLD.user_id; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              ELSE 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               -- Remove by guest_email for guest users 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                DELETE FROM group_participants 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 WHERE group_id = event_group_id AND guest_email = OLD.email; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   RETURN OLD; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    END; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     $$;


ALTER FUNCTION "public"."auto_remove_participant_from_group"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compact_slots_after_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    deleted_slot INTEGER;
    lock_key BIGINT;
BEGIN
    -- Get the slot number of the deleted participant
    deleted_slot := OLD.slot_number;

    -- Only compact if the deleted participant had a slot number
    IF deleted_slot IS NOT NULL THEN
        -- Create a deterministic lock key based on event_id
        lock_key := ('x' || substr(md5(OLD.event_id), 1, 15))::bit(60)::bigint;

        -- Acquire advisory lock to prevent race conditions
        PERFORM pg_advisory_lock(lock_key);

        BEGIN
            -- Shift all participants with higher slot numbers down by 1
            UPDATE participants
            SET slot_number = slot_number - 1
            WHERE event_id = OLD.event_id
            AND slot_number > deleted_slot;

        EXCEPTION
            WHEN OTHERS THEN
                -- Release lock on error and re-raise
                PERFORM pg_advisory_unlock(lock_key);
                RAISE;
        END;

        -- Release the advisory lock
        PERFORM pg_advisory_unlock(lock_key);
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."compact_slots_after_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_slot_number"("p_event_id" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_slot INTEGER;
    is_organizer BOOLEAN := FALSE;
    lock_key BIGINT;
    max_slot INTEGER;
BEGIN
    -- Create a deterministic lock key based on event_id
    lock_key := ('x' || substr(md5(p_event_id), 1, 15))::bit(60)::bigint;

    -- Acquire advisory lock to prevent race conditions
    PERFORM pg_advisory_lock(lock_key);

    BEGIN
        -- Check if user is the organizer of this event
        IF p_user_id IS NOT NULL THEN
            SELECT TRUE INTO is_organizer
            FROM events
            WHERE id = p_event_id AND organizer_id = p_user_id;
        END IF;

        -- If user is organizer, they always get slot #1
        IF is_organizer THEN
            -- Check if slot #1 is occupied by someone else (not the organizer)
            IF EXISTS (
                SELECT 1 FROM participants
                WHERE event_id = p_event_id
                AND slot_number = 1
                AND (user_id IS NULL OR user_id != p_user_id)
            ) THEN
                -- Get the current max slot to avoid conflicts
                SELECT COALESCE(MAX(slot_number), 0) INTO max_slot
                FROM participants
                WHERE event_id = p_event_id;

                -- First, shift all existing participants to negative numbers to avoid conflicts
                UPDATE participants
                SET slot_number = -(slot_number + max_slot + 100)
                WHERE event_id = p_event_id;

                -- Then shift them back to positive numbers, starting from slot 2
                UPDATE participants
                SET slot_number = -(slot_number + max_slot + 100) + 1
                WHERE event_id = p_event_id AND slot_number < 0;
            END IF;

            RETURN 1;
        END IF;

        -- For non-organizers, find the next available slot number
        SELECT COALESCE(MAX(slot_number), 0) + 1 INTO next_slot
        FROM participants
        WHERE event_id = p_event_id;

        -- Double-check that this slot is actually available (in case of gaps)
        WHILE EXISTS (
            SELECT 1 FROM participants
            WHERE event_id = p_event_id AND slot_number = next_slot
        ) LOOP
            next_slot := next_slot + 1;
        END LOOP;

        RETURN next_slot;
    EXCEPTION
        WHEN OTHERS THEN
            -- Release lock on error and re-raise
            PERFORM pg_advisory_unlock(lock_key);
            RAISE;
    END;

    -- Release the advisory lock
    PERFORM pg_advisory_unlock(lock_key);
END;
$$;


ALTER FUNCTION "public"."get_next_slot_number"("p_event_id" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_display_name"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    display_name TEXT;
BEGIN
    SELECT COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name',
        email
    ) INTO display_name
    FROM auth.users
    WHERE id = user_id;

    RETURN display_name;
END;
$$;


ALTER FUNCTION "public"."get_user_display_name"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_display_name"("user_id" "uuid") IS 'Helper function to get user display name from auth.users metadata. Returns full_name, name, or email in that order.';



CREATE OR REPLACE FUNCTION "public"."get_user_profile"("user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "email" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        COALESCE(
            u.raw_user_meta_data->>'full_name',
            u.raw_user_meta_data->>'name',
            u.email
        ) as name,
        u.email,
        u.created_at
    FROM auth.users u
    WHERE u.id = user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_profile"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_profile"("user_id" "uuid") IS 'Helper function to get user profile data including display name from auth.users.';



CREATE OR REPLACE FUNCTION "public"."nanoid"("size" integer DEFAULT 10) RETURNS "text"
    LANGUAGE "plpgsql" PARALLEL SAFE
    AS $$
DECLARE
    alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
    result text := '';
    i int;
    random_byte int;
BEGIN
    IF size IS NULL OR size < 1 THEN
        RAISE EXCEPTION 'The size must be defined and greater than 0!';
    END IF;

    FOR i IN 1..size LOOP
        random_byte := floor(random() * length(alphabet) + 1)::int;
        result := result || substr(alphabet, random_byte, 1);
    END LOOP;

    RETURN result;
END
$$;


ALTER FUNCTION "public"."nanoid"("size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_participants_from_group"("p_group_id" "text", "p_participant_ids" "text"[]) RETURNS TABLE("removed_count" integer, "failed_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     DECLARE 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          v_removed_count INTEGER := 0; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               v_failed_count INTEGER := 0; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    v_participant_id TEXT; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         v_user_id UUID; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              v_email TEXT; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   v_rows_deleted INTEGER; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    BEGIN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         -- Verify user has permission (is owner or admin of the group) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              IF NOT EXISTS ( 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       SELECT 1 FROM groups 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                WHERE id = p_group_id 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         AND ( 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      organizer_id = auth.uid() 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   OR EXISTS ( 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    SELECT 1 FROM group_admins 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     WHERE group_id = p_group_id 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      AND user_id = auth.uid() 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            ) 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 ) THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          RAISE EXCEPTION 'Unauthorized: User is not an admin of this group'; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      -- Process each participant in a single transaction 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           FOREACH v_participant_id IN ARRAY p_participant_ids 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                LOOP 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         BEGIN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      -- Get participant's stable identifiers 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   SELECT user_id, email INTO v_user_id, v_email 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                FROM participants 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             WHERE id = v_participant_id; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            IF NOT FOUND THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             v_failed_count := v_failed_count + 1; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              CONTINUE; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          -- Delete using stable identifiers 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       IF v_user_id IS NOT NULL THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        DELETE FROM group_participants 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         WHERE group_id = p_group_id 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          AND user_id = v_user_id; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       ELSIF v_email IS NOT NULL THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        DELETE FROM group_participants 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         WHERE group_id = p_group_id 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          AND guest_email = v_email; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       ELSE 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        v_failed_count := v_failed_count + 1; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         CONTINUE; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     GET DIAGNOSTICS v_rows_deleted = ROW_COUNT; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    IF v_rows_deleted > 0 THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     v_removed_count := v_removed_count + 1; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  ELSE 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   -- Participant was not in the group 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    v_failed_count := v_failed_count + 1; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 END IF; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            EXCEPTION 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         WHEN OTHERS THEN 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          v_failed_count := v_failed_count + 1; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   END; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        END LOOP; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               RETURN QUERY SELECT v_removed_count, v_failed_count; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                END; 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 $$;


ALTER FUNCTION "public"."remove_participants_from_group"("p_group_id" "text", "p_participant_ids" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."remove_participants_from_group"("p_group_id" "text", "p_participant_ids" "text"[]) IS 'Atomically remove multiple participants from a group. Only group owners and admins can execute. Returns counts of removed and failed operations.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "text" DEFAULT "public"."nanoid"(10) NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "datetime" timestamp with time zone,
    "location" "text",
    "is_private" boolean DEFAULT false NOT NULL,
    "custom_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "parent_event_id" "text",
    "max_participants" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_id" "text",
    "end_datetime" timestamp with time zone,
    CONSTRAINT "events_description_check" CHECK (("length"("description") <= 2000)),
    CONSTRAINT "events_end_datetime_after_start" CHECK ((("end_datetime" IS NULL) OR ("datetime" IS NULL) OR ("end_datetime" > "datetime"))),
    CONSTRAINT "events_group_id_nanoid_format" CHECK ((("group_id" IS NULL) OR ("group_id" ~ '^[A-Za-z0-9_-]{8,12}$'::"text"))),
    CONSTRAINT "events_id_nanoid_format" CHECK (("id" ~ '^[A-Za-z0-9_-]{8,12}$'::"text")),
    CONSTRAINT "events_location_check" CHECK (("length"("location") <= 500)),
    CONSTRAINT "events_max_participants_check" CHECK ((("max_participants" > 0) AND ("max_participants" <= 100))),
    CONSTRAINT "events_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) > 0) AND ("length"("name") <= 200))),
    CONSTRAINT "events_parent_event_id_nanoid_format" CHECK ((("parent_event_id" IS NULL) OR ("parent_event_id" ~ '^[A-Za-z0-9_-]{8,12}$'::"text")))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."group_id" IS 'Optional reference to the group this event belongs to. NULL means standalone event.';



COMMENT ON COLUMN "public"."events"."end_datetime" IS 'Optional end date and time for the event. Must be after the start datetime when provided.';



CREATE TABLE IF NOT EXISTS "public"."group_admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_admins_group_id_nanoid_format" CHECK (("group_id" ~ '^[A-Za-z0-9_-]{8,12}$'::"text"))
);


ALTER TABLE "public"."group_admins" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_admins" IS 'Stores admin roles for groups. Group owners can designate other organizers as admins who can help manage the group.';



CREATE TABLE IF NOT EXISTS "public"."group_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "text" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "guest_email" "text",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_participants_group_id_nanoid_format" CHECK (("group_id" ~ '^[A-Za-z0-9_-]{8,12}$'::"text")),
    CONSTRAINT "group_participants_identity_check" CHECK (((("user_id" IS NOT NULL) AND ("guest_email" IS NULL)) OR (("user_id" IS NULL) AND ("guest_email" IS NOT NULL))))
);


ALTER TABLE "public"."group_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_participants" IS 'Direct many-to-many relationship between groups and participants. Participants automatically join groups when registering for group events.';



CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "text" DEFAULT "public"."nanoid"(10) NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_private" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "groups_description_check" CHECK (("length"("description") <= 2000)),
    CONSTRAINT "groups_id_nanoid_format" CHECK (("id" ~ '^[A-Za-z0-9_-]{8,12}$'::"text")),
    CONSTRAINT "groups_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) > 0) AND ("length"("name") <= 200)))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."groups" IS 'Groups organize events and manage participant membership. Events can optionally belong to groups.';



CREATE TABLE IF NOT EXISTS "public"."labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#gray'::"text",
    CONSTRAINT "labels_color_check" CHECK (("color" ~ '^#[0-9a-fA-F]{6}$|^[a-z]+$'::"text")),
    CONSTRAINT "labels_event_id_nanoid_format" CHECK (("event_id" ~ '^[A-Za-z0-9_-]{8,12}$'::"text")),
    CONSTRAINT "labels_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) > 0) AND ("length"("name") <= 50)))
);


ALTER TABLE "public"."labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participant_labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "label_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."participant_labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "notes" "text",
    "user_id" "uuid",
    "responses" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slot_number" integer NOT NULL,
    "claimed_by_user_id" "uuid",
    CONSTRAINT "participants_email_check" CHECK ((("email" IS NULL) OR (("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text") AND ("length"("email") <= 254)))),
    CONSTRAINT "participants_event_id_nanoid_format" CHECK (("event_id" ~ '^[A-Za-z0-9_-]{8,12}$'::"text")),
    CONSTRAINT "participants_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) > 0) AND ("length"("name") <= 100))),
    CONSTRAINT "participants_notes_check" CHECK (("length"("notes") <= 1000)),
    CONSTRAINT "participants_phone_check" CHECK ((("phone" IS NULL) OR (("phone" ~ '^[+]?[0-9\s\-()]{0,20}$'::"text") AND ("length"("phone") <= 20))))
);


ALTER TABLE "public"."participants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."participants"."claimed_by_user_id" IS 'References the user who claimed this spot for someone else. NULL if the participant registered themselves.';



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_admins"
    ADD CONSTRAINT "group_admins_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_admins"
    ADD CONSTRAINT "group_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_participants"
    ADD CONSTRAINT "group_participants_group_id_guest_email_key" UNIQUE ("group_id", "guest_email");



ALTER TABLE ONLY "public"."group_participants"
    ADD CONSTRAINT "group_participants_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_participants"
    ADD CONSTRAINT "group_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participant_labels"
    ADD CONSTRAINT "participant_labels_participant_id_label_id_key" UNIQUE ("participant_id", "label_id");



ALTER TABLE ONLY "public"."participant_labels"
    ADD CONSTRAINT "participant_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_events_created_at" ON "public"."events" USING "btree" ("created_at");



CREATE INDEX "idx_events_datetime" ON "public"."events" USING "btree" ("datetime");



CREATE INDEX "idx_events_end_datetime" ON "public"."events" USING "btree" ("end_datetime");



CREATE INDEX "idx_events_group_id" ON "public"."events" USING "btree" ("group_id");



CREATE INDEX "idx_events_is_private" ON "public"."events" USING "btree" ("is_private");



CREATE INDEX "idx_events_organizer_id" ON "public"."events" USING "btree" ("organizer_id");



CREATE INDEX "idx_group_admins_group_id" ON "public"."group_admins" USING "btree" ("group_id");



CREATE INDEX "idx_group_admins_user_id" ON "public"."group_admins" USING "btree" ("user_id");



CREATE INDEX "idx_group_participants_group_id" ON "public"."group_participants" USING "btree" ("group_id");



CREATE INDEX "idx_group_participants_guest_email" ON "public"."group_participants" USING "btree" ("guest_email") WHERE ("guest_email" IS NOT NULL);



CREATE INDEX "idx_group_participants_joined_at" ON "public"."group_participants" USING "btree" ("joined_at");



CREATE INDEX "idx_group_participants_participant_id" ON "public"."group_participants" USING "btree" ("participant_id");



CREATE INDEX "idx_group_participants_user_id" ON "public"."group_participants" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_groups_created_at" ON "public"."groups" USING "btree" ("created_at");



CREATE INDEX "idx_groups_is_private" ON "public"."groups" USING "btree" ("is_private");



CREATE INDEX "idx_groups_organizer_id" ON "public"."groups" USING "btree" ("organizer_id");



CREATE INDEX "idx_labels_event_id" ON "public"."labels" USING "btree" ("event_id");



CREATE INDEX "idx_participant_labels_label_id" ON "public"."participant_labels" USING "btree" ("label_id");



CREATE INDEX "idx_participant_labels_participant_id" ON "public"."participant_labels" USING "btree" ("participant_id");



CREATE INDEX "idx_participants_claimed_by_user" ON "public"."participants" USING "btree" ("claimed_by_user_id") WHERE ("claimed_by_user_id" IS NOT NULL);



CREATE INDEX "idx_participants_created_at" ON "public"."participants" USING "btree" ("created_at");



CREATE INDEX "idx_participants_email" ON "public"."participants" USING "btree" ("email");



CREATE INDEX "idx_participants_event_id" ON "public"."participants" USING "btree" ("event_id");



CREATE UNIQUE INDEX "idx_participants_event_slot" ON "public"."participants" USING "btree" ("event_id", "slot_number");



CREATE INDEX "idx_participants_slot_number" ON "public"."participants" USING "btree" ("slot_number");



CREATE INDEX "idx_participants_user_id" ON "public"."participants" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "assign_participant_slot_trigger" BEFORE INSERT ON "public"."participants" FOR EACH ROW EXECUTE FUNCTION "public"."assign_participant_slot"();



CREATE OR REPLACE TRIGGER "auto_add_participant_to_group_trigger" AFTER INSERT ON "public"."participants" FOR EACH ROW EXECUTE FUNCTION "public"."auto_add_participant_to_group"();



CREATE OR REPLACE TRIGGER "auto_remove_participant_from_group_trigger" AFTER DELETE ON "public"."participants" FOR EACH ROW EXECUTE FUNCTION "public"."auto_remove_participant_from_group"();



CREATE OR REPLACE TRIGGER "compact_slots_after_participant_deletion" AFTER DELETE ON "public"."participants" FOR EACH ROW EXECUTE FUNCTION "public"."compact_slots_after_deletion"();



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_admins"
    ADD CONSTRAINT "group_admins_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_admins"
    ADD CONSTRAINT "group_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_participants"
    ADD CONSTRAINT "group_participants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_participants"
    ADD CONSTRAINT "group_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "labels_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participant_labels"
    ADD CONSTRAINT "participant_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participant_labels"
    ADD CONSTRAINT "participant_labels_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can register for public events" ON "public"."participants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "participants"."event_id") AND ("events"."is_private" = false)))));



CREATE POLICY "Anyone can view participants of public events" ON "public"."participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "participants"."event_id") AND (("events"."organizer_id" = "auth"."uid"()) OR ("events"."is_private" = false))))));



CREATE POLICY "Group owners can add admins" ON "public"."group_admins" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."groups"
  WHERE (("groups"."id" = "group_admins"."group_id") AND ("groups"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Group owners can remove admins" ON "public"."group_admins" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."groups"
  WHERE (("groups"."id" = "group_admins"."group_id") AND ("groups"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Group owners can view admins" ON "public"."group_admins" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."groups"
  WHERE (("groups"."id" = "group_admins"."group_id") AND ("groups"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers and admins can manage participants in their groups" ON "public"."group_participants" USING (((EXISTS ( SELECT 1
   FROM "public"."groups"
  WHERE (("groups"."id" = "group_participants"."group_id") AND ("groups"."organizer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."group_admins"
  WHERE (("group_admins"."group_id" = "group_participants"."group_id") AND ("group_admins"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Organizers can create events" ON "public"."events" FOR INSERT WITH CHECK (("organizer_id" = "auth"."uid"()));



CREATE POLICY "Organizers can delete own events" ON "public"."events" FOR DELETE USING (("organizer_id" = "auth"."uid"()));



CREATE POLICY "Organizers can delete participants from their events" ON "public"."participants" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "participants"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can manage labels for their events" ON "public"."labels" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "labels"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can manage participant labels for their events" ON "public"."participant_labels" USING ((EXISTS ( SELECT 1
   FROM ("public"."participants" "p"
     JOIN "public"."events" "e" ON (("e"."id" = "p"."event_id")))
  WHERE (("p"."id" = "participant_labels"."participant_id") AND ("e"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update own events" ON "public"."events" FOR UPDATE USING (("organizer_id" = "auth"."uid"()));



CREATE POLICY "Organizers can update participants in their events" ON "public"."participants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "participants"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own events" ON "public"."events" FOR SELECT USING ((("organizer_id" = "auth"."uid"()) OR ("is_private" = false)));



CREATE POLICY "Users can create own groups" ON "public"."groups" FOR INSERT WITH CHECK (("organizer_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own groups" ON "public"."groups" FOR DELETE USING (("organizer_id" = "auth"."uid"()));



CREATE POLICY "Users can update own groups" ON "public"."groups" FOR UPDATE USING (("organizer_id" = "auth"."uid"()));



CREATE POLICY "Users can view own groups" ON "public"."groups" FOR SELECT USING (("organizer_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own admin status" ON "public"."group_admins" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participant_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participants" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_participants_to_group"("p_group_id" "text", "p_participant_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."add_participants_to_group"("p_group_id" "text", "p_participant_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_participants_to_group"("p_group_id" "text", "p_participant_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_participant_slot"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_participant_slot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_participant_slot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_add_participant_to_group"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_add_participant_to_group"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_add_participant_to_group"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_remove_participant_from_group"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_remove_participant_from_group"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_remove_participant_from_group"() TO "service_role";



GRANT ALL ON FUNCTION "public"."compact_slots_after_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."compact_slots_after_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compact_slots_after_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_slot_number"("p_event_id" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_slot_number"("p_event_id" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_slot_number"("p_event_id" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."nanoid"("size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."nanoid"("size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nanoid"("size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_participants_from_group"("p_group_id" "text", "p_participant_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."remove_participants_from_group"("p_group_id" "text", "p_participant_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_participants_from_group"("p_group_id" "text", "p_participant_ids" "text"[]) TO "service_role";


















GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."group_admins" TO "anon";
GRANT ALL ON TABLE "public"."group_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."group_admins" TO "service_role";



GRANT ALL ON TABLE "public"."group_participants" TO "anon";
GRANT ALL ON TABLE "public"."group_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."group_participants" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."labels" TO "anon";
GRANT ALL ON TABLE "public"."labels" TO "authenticated";
GRANT ALL ON TABLE "public"."labels" TO "service_role";



GRANT ALL ON TABLE "public"."participant_labels" TO "anon";
GRANT ALL ON TABLE "public"."participant_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."participant_labels" TO "service_role";



GRANT ALL ON TABLE "public"."participants" TO "anon";
GRANT ALL ON TABLE "public"."participants" TO "authenticated";
GRANT ALL ON TABLE "public"."participants" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


