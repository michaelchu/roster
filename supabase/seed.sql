-- Seed data for development and testing
-- This file provides sample data to test nanoid event functionality
-- IDEMPOTENT: Safe to run multiple times without creating duplicates
--
-- IMPORTANT: Replace YOUR_USER_ID_HERE with your actual user ID from auth.users
-- To find your user ID, check Supabase Dashboard > Authentication > Users
-- Example: '8a8e0db2-6427-4e1e-969d-c35d8cfe4a82'

-- Sample events with nanoid IDs (these will be auto-generated)
-- Using INSERT...ON CONFLICT for idempotency based on unique name+organizer combination
DO $$
DECLARE
    user_id UUID := 'YOUR_USER_ID_HERE';
    badminton_event_id TEXT;
    workshop_event_id TEXT;
    holiday_event_id TEXT;
    yoga_event_id TEXT;
BEGIN
    -- Insert events only if they don't already exist (check by name + organizer_id)

    -- Badminton Event
    SELECT id INTO badminton_event_id
    FROM events
    WHERE name = 'Weekly Thursday Badminton' AND organizer_id = user_id;

    IF badminton_event_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, location, is_private, custom_fields, max_participants)
        VALUES (user_id, 'Weekly Thursday Badminton', 'Join us every Thursday for badminton at the community center. All skill levels welcome!', '2024-12-12T19:00:00Z', 'Community Sports Center', false, '[{"id": "dietary", "label": "Dietary Restrictions", "type": "text", "required": false}, {"id": "experience", "label": "Playing Experience", "type": "select", "required": true, "options": ["Beginner", "Intermediate", "Advanced"]}]'::jsonb, 20)
        RETURNING id INTO badminton_event_id;
        RAISE NOTICE 'Created Badminton event with ID: %', badminton_event_id;
    ELSE
        RAISE NOTICE 'Badminton event already exists with ID: %', badminton_event_id;
    END IF;

    -- Team Building Workshop
    SELECT id INTO workshop_event_id
    FROM events
    WHERE name = 'Team Building Workshop' AND organizer_id = user_id;

    IF workshop_event_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, location, is_private, custom_fields, max_participants)
        VALUES (user_id, 'Team Building Workshop', 'Private workshop for company team building activities', '2024-12-15T14:00:00Z', 'Conference Room A', true, '[{"id": "department", "label": "Department", "type": "text", "required": true}]'::jsonb, 15)
        RETURNING id INTO workshop_event_id;
        RAISE NOTICE 'Created Workshop event with ID: %', workshop_event_id;
    ELSE
        RAISE NOTICE 'Workshop event already exists with ID: %', workshop_event_id;
    END IF;

    -- Holiday Party Planning
    SELECT id INTO holiday_event_id
    FROM events
    WHERE name = 'Holiday Party Planning' AND organizer_id = user_id;

    IF holiday_event_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, location, is_private, custom_fields, max_participants)
        VALUES (user_id, 'Holiday Party Planning', 'Planning meeting for the upcoming holiday celebration', '2024-12-20T18:30:00Z', 'Main Office', false, '[{"id": "role", "label": "Planning Role", "type": "select", "required": false, "options": ["Decorations", "Food & Catering", "Entertainment", "Logistics", "Just Attending"]}]'::jsonb, 50)
        RETURNING id INTO holiday_event_id;
        RAISE NOTICE 'Created Holiday event with ID: %', holiday_event_id;
    ELSE
        RAISE NOTICE 'Holiday event already exists with ID: %', holiday_event_id;
    END IF;

    -- Morning Yoga Session
    SELECT id INTO yoga_event_id
    FROM events
    WHERE name = 'Morning Yoga Session' AND organizer_id = user_id;

    IF yoga_event_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, location, is_private, custom_fields, max_participants)
        VALUES (user_id, 'Morning Yoga Session', 'Start your day with a relaxing yoga session in the park', '2024-12-25T07:00:00Z', 'Central Park Pavilion', false, '[{"id": "level", "label": "Yoga Experience Level", "type": "select", "required": true, "options": ["Complete Beginner", "Some Experience", "Regular Practitioner"]}, {"id": "mat", "label": "Need to borrow a yoga mat?", "type": "select", "required": true, "options": ["Yes, please", "No, bringing my own"]}]'::jsonb, 25)
        RETURNING id INTO yoga_event_id;
        RAISE NOTICE 'Created Yoga event with ID: %', yoga_event_id;
    ELSE
        RAISE NOTICE 'Yoga event already exists with ID: %', yoga_event_id;
    END IF;

    -- Add sample guest participants (idempotent - check if they already exist)
    -- Badminton participants
    IF badminton_event_id IS NOT NULL THEN
        -- Alex Johnson
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND email = 'alex.johnson@example.com') THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (badminton_event_id, 'Alex Johnson', 'alex.johnson@example.com', '+1234567890', NULL, '{"dietary": "Vegetarian", "experience": "Intermediate"}'::jsonb);
            RAISE NOTICE 'Added participant: Alex Johnson to Badminton event';
        ELSE
            RAISE NOTICE 'Alex Johnson already registered for Badminton event';
        END IF;

        -- Sarah Chen
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND email = 'sarah.chen@example.com') THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (badminton_event_id, 'Sarah Chen', 'sarah.chen@example.com', '+1234567891', NULL, '{"dietary": "", "experience": "Beginner"}'::jsonb);
            RAISE NOTICE 'Added participant: Sarah Chen to Badminton event';
        ELSE
            RAISE NOTICE 'Sarah Chen already registered for Badminton event';
        END IF;

        -- Mike Torres
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND email = 'mike.torres@example.com') THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (badminton_event_id, 'Mike Torres', 'mike.torres@example.com', '+1234567892', NULL, '{"dietary": "No restrictions", "experience": "Advanced"}'::jsonb);
            RAISE NOTICE 'Added participant: Mike Torres to Badminton event';
        ELSE
            RAISE NOTICE 'Mike Torres already registered for Badminton event';
        END IF;
    END IF;

    -- Holiday party participants
    IF holiday_event_id IS NOT NULL THEN
        -- David Kim
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = holiday_event_id AND email = 'david.kim@example.com') THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (holiday_event_id, 'David Kim', 'david.kim@example.com', NULL, '{"role": "Food & Catering"}'::jsonb);
            RAISE NOTICE 'Added participant: David Kim to Holiday Party event';
        ELSE
            RAISE NOTICE 'David Kim already registered for Holiday Party event';
        END IF;

        -- Emily Rodriguez
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = holiday_event_id AND email = 'emily.rodriguez@example.com') THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (holiday_event_id, 'Emily Rodriguez', 'emily.rodriguez@example.com', NULL, '{"role": "Decorations"}'::jsonb);
            RAISE NOTICE 'Added participant: Emily Rodriguez to Holiday Party event';
        ELSE
            RAISE NOTICE 'Emily Rodriguez already registered for Holiday Party event';
        END IF;

        -- Lisa Wang
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = holiday_event_id AND email = 'lisa.wang@example.com') THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (holiday_event_id, 'Lisa Wang', 'lisa.wang@example.com', NULL, '{"role": "Entertainment"}'::jsonb);
            RAISE NOTICE 'Added participant: Lisa Wang to Holiday Party event';
        ELSE
            RAISE NOTICE 'Lisa Wang already registered for Holiday Party event';
        END IF;
    END IF;

    -- Yoga session participants
    IF yoga_event_id IS NOT NULL THEN
        -- Maya Patel
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = yoga_event_id AND email = 'maya.patel@example.com') THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (yoga_event_id, 'Maya Patel', 'maya.patel@example.com', '+1234567893', NULL, '{"level": "Regular Practitioner", "mat": "No, bringing my own"}'::jsonb);
            RAISE NOTICE 'Added participant: Maya Patel to Yoga event';
        ELSE
            RAISE NOTICE 'Maya Patel already registered for Yoga event';
        END IF;

        -- James Wilson
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = yoga_event_id AND email = 'james.wilson@example.com') THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (yoga_event_id, 'James Wilson', 'james.wilson@example.com', NULL, NULL, '{"level": "Complete Beginner", "mat": "Yes, please"}'::jsonb);
            RAISE NOTICE 'Added participant: James Wilson to Yoga event';
        ELSE
            RAISE NOTICE 'James Wilson already registered for Yoga event';
        END IF;

        -- Anna Schmidt
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = yoga_event_id AND email = 'anna.schmidt@example.com') THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (yoga_event_id, 'Anna Schmidt', 'anna.schmidt@example.com', '+1234567894', NULL, '{"level": "Some Experience", "mat": "Yes, please"}'::jsonb);
            RAISE NOTICE 'Added participant: Anna Schmidt to Yoga event';
        ELSE
            RAISE NOTICE 'Anna Schmidt already registered for Yoga event';
        END IF;
    END IF;

    -- Test nanoid generation
    RAISE NOTICE 'Seed data processing complete!';
    RAISE NOTICE 'Sample nanoid: %', nanoid(10);
    RAISE NOTICE 'Created events for user: %', user_id;

END $$;

-- Final verification - show created events
SELECT 'Seed script completed successfully!' as status;
SELECT id, name, is_private FROM events WHERE organizer_id = 'YOUR_USER_ID_HERE';
