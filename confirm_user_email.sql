-- Manually confirm a user's email address
-- Replace 'user@example.com' with the actual email address

UPDATE auth.users
SET
    email_confirmed_at = NOW(),
    confirmation_token = NULL,
    confirmation_sent_at = NULL
WHERE email = 'user@example.com';  -- Change this to the user's email

-- Verify the user was updated
SELECT
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users
WHERE email = 'user@example.com';  -- Change this to the user's email
