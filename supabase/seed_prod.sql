-- Production-safe seed script (idempotent)
-- NOTE: Do NOT run db reset in production. Execute this file in Supabase Studio SQL Editor.
-- This assumes the test user already exists (test_user@example.com). If not, create via Auth > Users.

DO $$
DECLARE
    target_email TEXT := 'test_user@example.com';
    organizer_user_id UUID;

    -- Group IDs
    sports_group_id TEXT;
    tech_group_id TEXT;

    -- Event IDs
    badminton_event_id TEXT;
    basketball_event_id TEXT;
    hackathon_event_id TEXT;
    workshop_event_id TEXT;
    standalone_yoga_id TEXT;
    standalone_party_id TEXT;
BEGIN
    -- Look up existing user by email
    SELECT id INTO organizer_user_id FROM auth.users WHERE email = target_email LIMIT 1;

    IF organizer_user_id IS NULL THEN
        RAISE EXCEPTION 'User % not found in production. Create it in Auth > Users (confirm email) first, then rerun.', target_email;
    END IF;

    RAISE NOTICE 'Using organizer ID: %', organizer_user_id;

    -- GROUPS
    SELECT id INTO sports_group_id FROM groups WHERE name = 'Sports & Recreation' AND organizer_id = organizer_user_id;
    IF sports_group_id IS NULL THEN
        INSERT INTO groups (organizer_id, name, description, is_private)
        VALUES (
            organizer_user_id,
            'Sports & Recreation',
            'Organizing regular sports activities for the community. Join us for badminton, basketball, and more!',
            false
        ) RETURNING id INTO sports_group_id;
        RAISE NOTICE 'Created Sports & Recreation group: %', sports_group_id;
    END IF;

    SELECT id INTO tech_group_id FROM groups WHERE name = 'Tech Meetup SF' AND organizer_id = organizer_user_id;
    IF tech_group_id IS NULL THEN
        INSERT INTO groups (organizer_id, name, description, is_private)
        VALUES (
            organizer_user_id,
            'Tech Meetup SF',
            'Monthly meetups for developers and tech enthusiasts in San Francisco',
            false
        ) RETURNING id INTO tech_group_id;
        RAISE NOTICE 'Created Tech Meetup group: %', tech_group_id;
    END IF;

    -- EVENTS IN GROUPS
    SELECT id INTO badminton_event_id FROM events WHERE name = 'Thursday Badminton' AND organizer_id = organizer_user_id;
    IF badminton_event_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, end_datetime, location, is_private, custom_fields, max_participants, group_id)
        VALUES (
            organizer_user_id,
            'Thursday Badminton',
            'Weekly badminton session. All skill levels welcome! Bring your own racket or borrow one.',
            (CURRENT_DATE + INTERVAL '3 days' + TIME '19:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '3 days' + TIME '21:00:00')::timestamptz,
            'Community Sports Center, Court 2',
            false,
            '[{"id":"experience","label":"Playing Experience","type":"select","required":true,"options":["Beginner","Intermediate","Advanced"]}]'::jsonb,
            20,
            sports_group_id
        ) RETURNING id INTO badminton_event_id;
        RAISE NOTICE 'Created Badminton event: %', badminton_event_id;
    END IF;

    SELECT id INTO basketball_event_id FROM events WHERE name = 'Weekend Basketball Pickup' AND organizer_id = organizer_user_id;
    IF basketball_event_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, end_datetime, location, is_private, custom_fields, max_participants, group_id)
        VALUES (
            organizer_user_id,
            'Weekend Basketball Pickup',
            'Casual pickup basketball game. Just show up and play!',
            (CURRENT_DATE + INTERVAL '5 days' + TIME '10:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '5 days' + TIME '12:00:00')::timestamptz,
            'Golden Gate Park Basketball Courts',
            false,
            '[{"id":"position","label":"Preferred Position","type":"select","required":false,"options":["Guard","Forward","Center","No preference"]}]'::jsonb,
            10,
            sports_group_id
        ) RETURNING id INTO basketball_event_id;
        RAISE NOTICE 'Created Basketball event: %', basketball_event_id;
    END IF;

    SELECT id INTO hackathon_event_id FROM events WHERE name = 'AI Hackathon 2026' AND organizer_id = organizer_user_id;
    IF hackathon_event_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, end_datetime, location, is_private, custom_fields, max_participants, group_id)
        VALUES (
            organizer_user_id,
            'AI Hackathon 2026',
            '24-hour hackathon focused on AI/ML applications. Form teams or join solo!',
            (CURRENT_DATE + INTERVAL '10 days' + TIME '09:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '11 days' + TIME '09:00:00')::timestamptz,
            'TechHub SF, 123 Market St',
            false,
            '[{"id":"skill_level","label":"Coding Experience","type":"select","required":true,"options":["Student","Junior Dev","Senior Dev","Designer"]},{"id":"dietary","label":"Dietary Restrictions","type":"text","required":false}]'::jsonb,
            50,
            tech_group_id
        ) RETURNING id INTO hackathon_event_id;
        RAISE NOTICE 'Created Hackathon event: %', hackathon_event_id;
    END IF;

    SELECT id INTO workshop_event_id FROM events WHERE name = 'React 19 Workshop' AND organizer_id = organizer_user_id;
    IF workshop_event_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, end_datetime, location, is_private, custom_fields, max_participants, group_id)
        VALUES (
            organizer_user_id,
            'React 19 Workshop',
            'Hands-on workshop covering React 19 new features. Bring your laptop!',
            (CURRENT_DATE + INTERVAL '7 days' + TIME '18:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '7 days' + TIME '20:00:00')::timestamptz,
            'WeWork SoMa, Conference Room A',
            false,
            '[{"id":"experience","label":"React Experience","type":"select","required":true,"options":["Never used","Basic","Intermediate","Expert"]}]'::jsonb,
            30,
            tech_group_id
        ) RETURNING id INTO workshop_event_id;
        RAISE NOTICE 'Created Workshop event: %', workshop_event_id;
    END IF;

    -- STANDALONE EVENTS
    SELECT id INTO standalone_yoga_id FROM events WHERE name = 'Morning Yoga in the Park' AND organizer_id = organizer_user_id;
    IF standalone_yoga_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, end_datetime, location, is_private, custom_fields, max_participants, group_id)
        VALUES (
            organizer_user_id,
            'Morning Yoga in the Park',
            'Start your day with relaxing yoga session outdoors. Perfect for beginners!',
            (CURRENT_DATE + INTERVAL '2 days' + TIME '07:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '2 days' + TIME '08:00:00')::timestamptz,
            'Dolores Park, Near Playground',
            false,
            '[{"id":"level","label":"Yoga Experience","type":"select","required":true,"options":["Complete Beginner","Some Experience","Regular Practitioner"]},{"id":"mat","label":"Need yoga mat?","type":"select","required":true,"options":["Yes, please","No, bringing my own"]}]'::jsonb,
            25,
            NULL
        ) RETURNING id INTO standalone_yoga_id;
        RAISE NOTICE 'Created Yoga event: %', standalone_yoga_id;
    END IF;

    SELECT id INTO standalone_party_id FROM events WHERE name = 'New Year Party 2026' AND organizer_id = organizer_user_id;
    IF standalone_party_id IS NULL THEN
        INSERT INTO events (organizer_id, name, description, datetime, end_datetime, location, is_private, custom_fields, max_participants, group_id)
        VALUES (
            organizer_user_id,
            'New Year Party 2026',
            'Celebrate the new year with food, drinks, and great company! RSVP to let us know you''re coming.',
            (CURRENT_DATE + INTERVAL '14 days' + TIME '20:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '15 days' + TIME '02:00:00')::timestamptz,
            'Private Venue, Address TBD',
            false,
            '[{"id":"plus_one","label":"Bringing a plus one?","type":"select","required":true,"options":["Just me","Bringing someone"]},{"id":"dietary","label":"Dietary Restrictions","type":"text","required":false}]'::jsonb,
            100,
            NULL
        ) RETURNING id INTO standalone_party_id;
        RAISE NOTICE 'Created Party event: %', standalone_party_id;
    END IF;

    -- PARTICIPANTS (same as dev script; upserts by event_id+email)
    -- Badminton
    IF badminton_event_id IS NOT NULL THEN
        INSERT INTO participants (event_id, name, email, phone, responses)
        SELECT badminton_event_id, 'Alex Johnson', 'alex.johnson@example.com', '+14155551001', '{"experience":"Intermediate"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND email = 'alex.johnson@example.com');
        INSERT INTO participants (event_id, name, email, phone, responses)
        SELECT badminton_event_id, 'Sarah Chen', 'sarah.chen@example.com', '+14155551002', '{"experience":"Beginner"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND email = 'sarah.chen@example.com');
        INSERT INTO participants (event_id, name, email, phone, responses)
        SELECT badminton_event_id, 'Mike Torres', 'mike.torres@example.com', '+14155551003', '{"experience":"Advanced"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND email = 'mike.torres@example.com');
    END IF;

    -- Basketball
    IF basketball_event_id IS NOT NULL THEN
        INSERT INTO participants (event_id, name, email, responses)
        SELECT basketball_event_id, 'Alex Johnson', 'alex.johnson@example.com', '{"position":"Guard"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = basketball_event_id AND email = 'alex.johnson@example.com');
        INSERT INTO participants (event_id, name, email, responses)
        SELECT basketball_event_id, 'David Kim', 'david.kim@example.com', '{"position":"Forward"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = basketball_event_id AND email = 'david.kim@example.com');
    END IF;

    -- Hackathon
    IF hackathon_event_id IS NOT NULL THEN
        INSERT INTO participants (event_id, name, email, responses)
        SELECT hackathon_event_id, 'Emily Rodriguez', 'emily.rodriguez@example.com', '{"skill_level":"Senior Dev","dietary":"Vegetarian"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = hackathon_event_id AND email = 'emily.rodriguez@example.com');
        INSERT INTO participants (event_id, name, email, responses)
        SELECT hackathon_event_id, 'James Wilson', 'james.wilson@example.com', '{"skill_level":"Junior Dev","dietary":""}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = hackathon_event_id AND email = 'james.wilson@example.com');
        INSERT INTO participants (event_id, name, email, responses)
        SELECT hackathon_event_id, 'Lisa Wang', 'lisa.wang@example.com', '{"skill_level":"Designer","dietary":"Vegan"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = hackathon_event_id AND email = 'lisa.wang@example.com');
    END IF;

    -- Workshop
    IF workshop_event_id IS NOT NULL THEN
        INSERT INTO participants (event_id, name, email, responses)
        SELECT workshop_event_id, 'Sarah Chen', 'sarah.chen@example.com', '{"experience":"Basic"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = workshop_event_id AND email = 'sarah.chen@example.com');
        INSERT INTO participants (event_id, name, email, responses)
        SELECT workshop_event_id, 'Maya Patel', 'maya.patel@example.com', '{"experience":"Intermediate"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = workshop_event_id AND email = 'maya.patel@example.com');
    END IF;

    -- Yoga
    IF standalone_yoga_id IS NOT NULL THEN
        INSERT INTO participants (event_id, name, email, phone, responses)
        SELECT standalone_yoga_id, 'Maya Patel', 'maya.patel@example.com', '+14155551004', '{"level":"Regular Practitioner","mat":"No, bringing my own"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_yoga_id AND email = 'maya.patel@example.com');
        INSERT INTO participants (event_id, name, email, responses)
        SELECT standalone_yoga_id, 'Anna Schmidt', 'anna.schmidt@example.com', '{"level":"Complete Beginner","mat":"Yes, please"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_yoga_id AND email = 'anna.schmidt@example.com');
    END IF;

    -- Party
    IF standalone_party_id IS NOT NULL THEN
        INSERT INTO participants (event_id, name, email, responses)
        SELECT standalone_party_id, 'Mike Torres', 'mike.torres@example.com', '{"plus_one":"Bringing someone","dietary":""}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_party_id AND email = 'mike.torres@example.com');
        INSERT INTO participants (event_id, name, email, responses)
        SELECT standalone_party_id, 'David Kim', 'david.kim@example.com', '{"plus_one":"Just me","dietary":"No shellfish"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_party_id AND email = 'david.kim@example.com');
        INSERT INTO participants (event_id, name, email, responses)
        SELECT standalone_party_id, 'Lisa Wang', 'lisa.wang@example.com', '{"plus_one":"Just me","dietary":"Vegan"}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_party_id AND email = 'lisa.wang@example.com');
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROD SEED COMPLETE for %', target_email;
    RAISE NOTICE '========================================';
END $$;

-- Summary queries (optional)
SELECT COUNT(*) as total_groups FROM groups WHERE organizer_id IN (SELECT id FROM auth.users WHERE email = 'test_user@example.com');
SELECT COUNT(*) as total_events FROM events WHERE organizer_id IN (SELECT id FROM auth.users WHERE email = 'test_user@example.com');
SELECT COUNT(*) as total_participants FROM participants WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM auth.users WHERE email = 'test_user@example.com'));
