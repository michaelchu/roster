-- Fix organizer creation trigger to handle missing name metadata
-- This migration updates the handle_new_user function to properly handle
-- cases where no name is provided in user metadata

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO organizers (id, name)
    VALUES (NEW.id, NULL)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
