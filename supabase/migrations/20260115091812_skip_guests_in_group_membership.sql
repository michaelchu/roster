-- Update auto_add_participant_to_group to only add authenticated users to group membership
-- Guest participants and claimed spots will only exist as event participants, not group members
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
    
    -- Only add authenticated users to group membership
    -- Guest participants and claimed spots are excluded from group membership
    IF event_group_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN 
        -- Authenticated user: upsert on group_id + user_id 
        INSERT INTO group_participants (group_id, participant_id, user_id, joined_at) 
        VALUES (event_group_id, NEW.id, NEW.user_id, NEW.created_at) 
        ON CONFLICT (group_id, user_id) DO UPDATE SET 
            participant_id = NEW.id, -- Update to latest registration for traceability 
            joined_at = LEAST(group_participants.joined_at, NEW.created_at); -- Keep earliest join date 
    END IF; 
    
    RETURN NEW; 
END; 
$$;
