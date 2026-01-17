-- Comprehensive Seed Data for Development
-- Creates groups, events (with and without groups), and participants
-- IDEMPOTENT: Safe to run multiple times
--
-- Run with: npx supabase db reset

-- Helper function to create or get user
CREATE OR REPLACE FUNCTION get_or_create_user(user_email TEXT, user_name TEXT) RETURNS UUID AS $$
DECLARE
    user_uuid UUID;
BEGIN
    SELECT id INTO user_uuid FROM auth.users WHERE email = user_email LIMIT 1;
    
    IF user_uuid IS NULL THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, confirmation_sent_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            user_email,
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', user_name),
            NOW(),
            NOW(),
            NOW()
        ) RETURNING id INTO user_uuid;
        
        INSERT INTO auth.identities (
            id, provider_id, user_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            user_uuid::text,
            user_uuid,
            jsonb_build_object('sub', user_uuid::text, 'email', user_email),
            'email',
            NOW(),
            NOW(),
            NOW()
        );
    END IF;
    
    RETURN user_uuid;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    -- Seed target user
    target_email TEXT := 'test_user@example.com';
    target_password TEXT := 'password123';
    -- Get user ID from email
    organizer_user_id UUID;
    
    -- Additional test users
    alex_user_id UUID;
    sarah_user_id UUID;
    mike_user_id UUID;
    david_user_id UUID;
    emily_user_id UUID;
    james_user_id UUID;
    lisa_user_id UUID;
    maya_user_id UUID;
    
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
    -- Get or create the seed user
    SELECT id INTO organizer_user_id
    FROM auth.users
    WHERE email = target_email
    LIMIT 1;
    
    IF organizer_user_id IS NULL THEN
        RAISE NOTICE 'User % not found. Creating test user...', target_email;
        
        -- Create user in auth.users (simulating email signup)
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            is_super_admin,
            confirmation_sent_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
target_email,
            crypt(target_password, gen_salt('bf')),
            NOW(),
            '',
            '',
            '',
            '',
            '{"provider":"email","providers":["email"]}',
            '{}',
            NOW(),
            NOW(),
            false,
            NOW()
        )
        RETURNING id INTO organizer_user_id;
        
        -- Create corresponding identity
        INSERT INTO auth.identities (
            id,
            provider_id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            organizer_user_id::text,
            organizer_user_id,
            jsonb_build_object('sub', organizer_user_id::text, 'email', target_email),
            'email',
            NOW(),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created test user with email: %, password: %', target_email, target_password;
    END IF;
    
    RAISE NOTICE 'Using organizer ID: %', organizer_user_id;
    
    -- ========================================
    -- CREATE ADDITIONAL TEST USERS
    -- ========================================
    
    -- Create test users
    alex_user_id := get_or_create_user('alex.johnson@example.com', 'Alex Johnson');
    sarah_user_id := get_or_create_user('sarah.chen@example.com', 'Sarah Chen');
    mike_user_id := get_or_create_user('mike.torres@example.com', 'Mike Torres');
    david_user_id := get_or_create_user('david.kim@example.com', 'David Kim');
    emily_user_id := get_or_create_user('emily.rodriguez@example.com', 'Emily Rodriguez');
    james_user_id := get_or_create_user('james.wilson@example.com', 'James Wilson');
    lisa_user_id := get_or_create_user('lisa.wang@example.com', 'Lisa Wang');
    maya_user_id := get_or_create_user('maya.patel@example.com', 'Maya Patel');
    
    RAISE NOTICE 'Created additional test users';
    
    -- ========================================
    -- CREATE GROUPS
    -- ========================================
    
    -- Sports & Recreation Group
    SELECT id INTO sports_group_id
    FROM groups
    WHERE name = 'Sports & Recreation' AND organizer_id = organizer_user_id;
    
    IF sports_group_id IS NULL THEN
        INSERT INTO groups (organizer_id, name, description)
        VALUES (
            organizer_user_id,
            'Sports & Recreation',
            'Organizing regular sports activities for the community. Join us for badminton, basketball, and more!'
        )
        RETURNING id INTO sports_group_id;
        RAISE NOTICE 'Created Sports & Recreation group: %', sports_group_id;
    ELSE
        RAISE NOTICE 'Sports & Recreation group exists: %', sports_group_id;
    END IF;
    
    -- Tech Meetup Group
    SELECT id INTO tech_group_id
    FROM groups
    WHERE name = 'Tech Meetup SF' AND organizer_id = organizer_user_id;
    
    IF tech_group_id IS NULL THEN
        INSERT INTO groups (organizer_id, name, description)
        VALUES (
            organizer_user_id,
            'Tech Meetup SF',
            'Monthly meetups for developers and tech enthusiasts in San Francisco'
        )
        RETURNING id INTO tech_group_id;
        RAISE NOTICE 'Created Tech Meetup group: %', tech_group_id;
    ELSE
        RAISE NOTICE 'Tech Meetup group exists: %', tech_group_id;
    END IF;
    
    -- ========================================
    -- CREATE EVENTS (WITH GROUPS)
    -- ========================================
    
    -- Badminton Event (in Sports group)
    SELECT id INTO badminton_event_id
    FROM events
    WHERE name = 'Thursday Badminton' AND organizer_id = organizer_user_id;
    
    IF badminton_event_id IS NULL THEN
        INSERT INTO events (
            organizer_id, name, description, datetime, end_datetime,
            location, custom_fields, max_participants, group_id
        )
        VALUES (
            organizer_user_id,
            'Thursday Badminton',
            'Weekly badminton session. All skill levels welcome! Bring your own racket or borrow one.',
            (CURRENT_DATE + INTERVAL '3 days' + TIME '19:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '3 days' + TIME '21:00:00')::timestamptz,
            'Community Sports Center, Court 2',
            '[{
                "id": "experience",
                "label": "Playing Experience",
                "type": "select",
                "required": true,
                "options": ["Beginner", "Intermediate", "Advanced"]
            }]'::jsonb,
            20,
            sports_group_id
        )
        RETURNING id INTO badminton_event_id;
        RAISE NOTICE 'Created Badminton event: %', badminton_event_id;
    ELSE
        RAISE NOTICE 'Badminton event exists: %', badminton_event_id;
    END IF;
    
    -- Basketball Event (in Sports group)
    SELECT id INTO basketball_event_id
    FROM events
    WHERE name = 'Weekend Basketball Pickup' AND organizer_id = organizer_user_id;
    
    IF basketball_event_id IS NULL THEN
        INSERT INTO events (
            organizer_id, name, description, datetime, end_datetime,
            location, custom_fields, max_participants, group_id
        )
        VALUES (
            organizer_user_id,
            'Weekend Basketball Pickup',
            'Casual pickup basketball game. Just show up and play!',
            (CURRENT_DATE + INTERVAL '5 days' + TIME '10:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '5 days' + TIME '12:00:00')::timestamptz,
            'Golden Gate Park Basketball Courts',
            '[{
                "id": "position",
                "label": "Preferred Position",
                "type": "select",
                "required": false,
                "options": ["Guard", "Forward", "Center", "No preference"]
            }]'::jsonb,
            10,
            sports_group_id
        )
        RETURNING id INTO basketball_event_id;
        RAISE NOTICE 'Created Basketball event: %', basketball_event_id;
    ELSE
        RAISE NOTICE 'Basketball event exists: %', basketball_event_id;
    END IF;
    
    -- Hackathon Event (in Tech group)
    SELECT id INTO hackathon_event_id
    FROM events
    WHERE name = 'AI Hackathon 2026' AND organizer_id = organizer_user_id;
    
    IF hackathon_event_id IS NULL THEN
        INSERT INTO events (
            organizer_id, name, description, datetime, end_datetime,
            location, custom_fields, max_participants, group_id
        )
        VALUES (
            organizer_user_id,
            'AI Hackathon 2026',
            '24-hour hackathon focused on AI/ML applications. Form teams or join solo!',
            (CURRENT_DATE + INTERVAL '10 days' + TIME '09:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '11 days' + TIME '09:00:00')::timestamptz,
            'TechHub SF, 123 Market St',
            '[{
                "id": "skill_level",
                "label": "Coding Experience",
                "type": "select",
                "required": true,
                "options": ["Student", "Junior Dev", "Senior Dev", "Designer"]
            }, {
                "id": "dietary",
                "label": "Dietary Restrictions",
                "type": "text",
                "required": false
            }]'::jsonb,
            50,
            tech_group_id
        )
        RETURNING id INTO hackathon_event_id;
        RAISE NOTICE 'Created Hackathon event: %', hackathon_event_id;
    ELSE
        RAISE NOTICE 'Hackathon event exists: %', hackathon_event_id;
    END IF;
    
    -- Workshop Event (in Tech group)
    SELECT id INTO workshop_event_id
    FROM events
    WHERE name = 'React 19 Workshop' AND organizer_id = organizer_user_id;
    
    IF workshop_event_id IS NULL THEN
        INSERT INTO events (
            organizer_id, name, description, datetime, end_datetime,
            location, custom_fields, max_participants, group_id
        )
        VALUES (
            organizer_user_id,
            'React 19 Workshop',
            'Hands-on workshop covering React 19 new features. Bring your laptop!',
            (CURRENT_DATE + INTERVAL '7 days' + TIME '18:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '7 days' + TIME '20:00:00')::timestamptz,
            'WeWork SoMa, Conference Room A',
            '[{
                "id": "experience",
                "label": "React Experience",
                "type": "select",
                "required": true,
                "options": ["Never used", "Basic", "Intermediate", "Expert"]
            }]'::jsonb,
            30,
            tech_group_id
        )
        RETURNING id INTO workshop_event_id;
        RAISE NOTICE 'Created Workshop event: %', workshop_event_id;
    ELSE
        RAISE NOTICE 'Workshop event exists: %', workshop_event_id;
    END IF;
    
    -- ========================================
    -- CREATE STANDALONE EVENTS (NO GROUP)
    -- ========================================
    
    -- Yoga Event
    SELECT id INTO standalone_yoga_id
    FROM events
    WHERE name = 'Morning Yoga in the Park' AND organizer_id = organizer_user_id;
    
    IF standalone_yoga_id IS NULL THEN
        INSERT INTO events (
            organizer_id, name, description, datetime, end_datetime,
            location, custom_fields, max_participants, group_id
        )
        VALUES (
            organizer_user_id,
            'Morning Yoga in the Park',
            'Start your day with relaxing yoga session outdoors. Perfect for beginners!',
            (CURRENT_DATE + INTERVAL '2 days' + TIME '07:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '2 days' + TIME '08:00:00')::timestamptz,
            'Dolores Park, Near Playground',
            '[{
                "id": "level",
                "label": "Yoga Experience",
                "type": "select",
                "required": true,
                "options": ["Complete Beginner", "Some Experience", "Regular Practitioner"]
            }, {
                "id": "mat",
                "label": "Need yoga mat?",
                "type": "select",
                "required": true,
                "options": ["Yes, please", "No, bringing my own"]
            }]'::jsonb,
            25,
            NULL
        )
        RETURNING id INTO standalone_yoga_id;
        RAISE NOTICE 'Created Yoga event: %', standalone_yoga_id;
    ELSE
        RAISE NOTICE 'Yoga event exists: %', standalone_yoga_id;
    END IF;
    
    -- Holiday Party Event
    SELECT id INTO standalone_party_id
    FROM events
    WHERE name = 'New Year Party 2026' AND organizer_id = organizer_user_id;
    
    IF standalone_party_id IS NULL THEN
        INSERT INTO events (
            organizer_id, name, description, datetime, end_datetime,
            location, custom_fields, max_participants, group_id
        )
        VALUES (
            organizer_user_id,
            'New Year Party 2026',
            'Celebrate the new year with food, drinks, and great company! RSVP to let us know you''re coming.',
            (CURRENT_DATE + INTERVAL '14 days' + TIME '20:00:00')::timestamptz,
            (CURRENT_DATE + INTERVAL '15 days' + TIME '02:00:00')::timestamptz,
            'Private Venue, Address TBD',
            '[{
                "id": "plus_one",
                "label": "Bringing a plus one?",
                "type": "select",
                "required": true,
                "options": ["Just me", "Bringing someone"]
            }, {
                "id": "dietary",
                "label": "Dietary Restrictions",
                "type": "text",
                "required": false
            }]'::jsonb,
            100,
            NULL
        )
        RETURNING id INTO standalone_party_id;
        RAISE NOTICE 'Created Party event: %', standalone_party_id;
    ELSE
        RAISE NOTICE 'Party event exists: %', standalone_party_id;
    END IF;
    
    -- ========================================
    -- ADD PARTICIPANTS TO EVENTS
    -- ========================================
    
    -- Badminton participants (group event - authenticated users)
    IF badminton_event_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND user_id = organizer_user_id) THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (badminton_event_id, 'Test User', 'test_user@example.com', '+14155550000', organizer_user_id, '{"experience": "Intermediate"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND user_id = alex_user_id) THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (badminton_event_id, 'Alex Johnson', 'alex.johnson@example.com', '+14155551001', alex_user_id, '{"experience": "Intermediate"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND user_id = sarah_user_id) THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (badminton_event_id, 'Sarah Chen', 'sarah.chen@example.com', '+14155551002', sarah_user_id, '{"experience": "Beginner"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = badminton_event_id AND user_id = mike_user_id) THEN
            INSERT INTO participants (event_id, name, email, phone, user_id, responses)
            VALUES (badminton_event_id, 'Mike Torres', 'mike.torres@example.com', '+14155551003', mike_user_id, '{"experience": "Advanced"}'::jsonb);
        END IF;
        
        RAISE NOTICE 'Added participants to Badminton event';
    END IF;
    
    -- Basketball participants (group event - authenticated users)
    IF basketball_event_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = basketball_event_id AND user_id = organizer_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (basketball_event_id, 'Test User', 'test_user@example.com', organizer_user_id, '{"position": "Guard"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = basketball_event_id AND user_id = alex_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (basketball_event_id, 'Alex Johnson', 'alex.johnson@example.com', alex_user_id, '{"position": "Guard"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = basketball_event_id AND user_id = david_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (basketball_event_id, 'David Kim', 'david.kim@example.com', david_user_id, '{"position": "Forward"}'::jsonb);
        END IF;
        
        RAISE NOTICE 'Added participants to Basketball event';
    END IF;
    
    -- Hackathon participants (group event - authenticated users)
    IF hackathon_event_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = hackathon_event_id AND user_id = organizer_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (hackathon_event_id, 'Test User', 'test_user@example.com', organizer_user_id, '{"skill_level": "Senior Dev", "dietary": ""}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = hackathon_event_id AND user_id = emily_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (hackathon_event_id, 'Emily Rodriguez', 'emily.rodriguez@example.com', emily_user_id, '{"skill_level": "Senior Dev", "dietary": "Vegetarian"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = hackathon_event_id AND user_id = james_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (hackathon_event_id, 'James Wilson', 'james.wilson@example.com', james_user_id, '{"skill_level": "Junior Dev", "dietary": ""}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = hackathon_event_id AND user_id = lisa_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (hackathon_event_id, 'Lisa Wang', 'lisa.wang@example.com', lisa_user_id, '{"skill_level": "Designer", "dietary": "Vegan"}'::jsonb);
        END IF;
        
        RAISE NOTICE 'Added participants to Hackathon event';
    END IF;
    
    -- Workshop participants (group event - authenticated users)
    IF workshop_event_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = workshop_event_id AND user_id = organizer_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (workshop_event_id, 'Test User', 'test_user@example.com', organizer_user_id, '{"experience": "Intermediate"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = workshop_event_id AND user_id = sarah_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (workshop_event_id, 'Sarah Chen', 'sarah.chen@example.com', sarah_user_id, '{"experience": "Basic"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = workshop_event_id AND user_id = maya_user_id) THEN
            INSERT INTO participants (event_id, name, email, user_id, responses)
            VALUES (workshop_event_id, 'Maya Patel', 'maya.patel@example.com', maya_user_id, '{"experience": "Intermediate"}'::jsonb);
        END IF;
        
        RAISE NOTICE 'Added participants to Workshop event';
    END IF;
    
    -- Yoga participants
    IF standalone_yoga_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_yoga_id AND email = 'maya.patel@example.com') THEN
            INSERT INTO participants (event_id, name, email, phone, responses)
            VALUES (standalone_yoga_id, 'Maya Patel', 'maya.patel@example.com', '+14155551004', '{"level": "Regular Practitioner", "mat": "No, bringing my own"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_yoga_id AND email = 'anna.schmidt@example.com') THEN
            INSERT INTO participants (event_id, name, email, responses)
            VALUES (standalone_yoga_id, 'Anna Schmidt', 'anna.schmidt@example.com', '{"level": "Complete Beginner", "mat": "Yes, please"}'::jsonb);
        END IF;
        
        RAISE NOTICE 'Added participants to Yoga event';
    END IF;
    
    -- Party participants
    IF standalone_party_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_party_id AND email = 'mike.torres@example.com') THEN
            INSERT INTO participants (event_id, name, email, responses)
            VALUES (standalone_party_id, 'Mike Torres', 'mike.torres@example.com', '{"plus_one": "Bringing someone", "dietary": ""}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_party_id AND email = 'david.kim@example.com') THEN
            INSERT INTO participants (event_id, name, email, responses)
            VALUES (standalone_party_id, 'David Kim', 'david.kim@example.com', '{"plus_one": "Just me", "dietary": "No shellfish"}'::jsonb);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM participants WHERE event_id = standalone_party_id AND email = 'lisa.wang@example.com') THEN
            INSERT INTO participants (event_id, name, email, responses)
            VALUES (standalone_party_id, 'Lisa Wang', 'lisa.wang@example.com', '{"plus_one": "Just me", "dietary": "Vegan"}'::jsonb);
        END IF;
        
        RAISE NOTICE 'Added participants to Party event';
    END IF;
    
    -- ========================================
    -- ADD GROUP MEMBERSHIPS
    -- Since auto-join trigger was removed, explicitly add users to groups
    -- ========================================

    -- Add members to Sports & Recreation group
    IF sports_group_id IS NOT NULL THEN
        -- Organizer
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = sports_group_id AND user_id = organizer_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (sports_group_id, organizer_user_id);
        END IF;
        -- Alex (registered for Badminton and Basketball)
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = sports_group_id AND user_id = alex_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (sports_group_id, alex_user_id);
        END IF;
        -- Sarah (registered for Badminton)
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = sports_group_id AND user_id = sarah_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (sports_group_id, sarah_user_id);
        END IF;
        -- Mike (registered for Badminton)
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = sports_group_id AND user_id = mike_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (sports_group_id, mike_user_id);
        END IF;
        -- David (registered for Basketball)
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = sports_group_id AND user_id = david_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (sports_group_id, david_user_id);
        END IF;

        RAISE NOTICE 'Added members to Sports & Recreation group';
    END IF;

    -- Add members to Tech Meetup group
    IF tech_group_id IS NOT NULL THEN
        -- Organizer
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = tech_group_id AND user_id = organizer_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (tech_group_id, organizer_user_id);
        END IF;
        -- Emily (registered for Hackathon and Workshop)
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = tech_group_id AND user_id = emily_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (tech_group_id, emily_user_id);
        END IF;
        -- James (registered for Hackathon)
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = tech_group_id AND user_id = james_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (tech_group_id, james_user_id);
        END IF;
        -- Lisa (registered for Hackathon and Workshop)
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = tech_group_id AND user_id = lisa_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (tech_group_id, lisa_user_id);
        END IF;
        -- Maya (registered for Workshop)
        IF NOT EXISTS (SELECT 1 FROM group_participants WHERE group_id = tech_group_id AND user_id = maya_user_id) THEN
            INSERT INTO group_participants (group_id, user_id) VALUES (tech_group_id, maya_user_id);
        END IF;

        RAISE NOTICE 'Added members to Tech Meetup group';
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SEED DATA COMPLETE!';
    RAISE NOTICE 'Created 2 groups, 6 events, and multiple participants';
    RAISE NOTICE 'User: % (%)' , target_email, organizer_user_id;
    RAISE NOTICE '========================================';
    
END $$;

-- Show summary
SELECT 'Seed script completed successfully!' as status;
SELECT COUNT(*) as total_groups FROM groups WHERE organizer_id IN (SELECT id FROM auth.users WHERE email = 'test_user@example.com');
SELECT COUNT(*) as total_events FROM events WHERE organizer_id IN (SELECT id FROM auth.users WHERE email = 'test_user@example.com');
SELECT COUNT(*) as total_participants FROM participants WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM auth.users WHERE email = 'test_user@example.com'));
