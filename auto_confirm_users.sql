-- Auto-confirm all new users on signup (for development)
-- WARNING: Only use this in development/testing environments

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Auto-confirm the email
    NEW.email_confirmed_at = NOW();
    NEW.confirmation_token = NULL;
    NEW.confirmation_sent_at = NULL;
    RETURN NEW;
END;
$$;

-- Create trigger to auto-confirm users before they're inserted
DROP TRIGGER IF EXISTS auto_confirm_new_users ON auth.users;
CREATE TRIGGER auto_confirm_new_users
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_user();

-- Note: This will auto-confirm all future signups
-- To remove this behavior later, run: DROP TRIGGER auto_confirm_new_users ON auth.users;
