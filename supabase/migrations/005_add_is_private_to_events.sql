-- Add is_private column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.events.is_private IS 'Indicates if the event is private and requires authentication to view';
