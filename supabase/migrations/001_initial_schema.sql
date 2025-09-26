-- Create organizers table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS organizers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  datetime TIMESTAMP WITH TIME ZONE,
  location TEXT,
  custom_fields JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  parent_event_id UUID REFERENCES events(id),
  CONSTRAINT custom_fields_is_array CHECK (jsonb_typeof(custom_fields) = 'array')
);

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  responses JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create labels table
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#gray',
  UNIQUE(event_id, name)
);

-- Create participant_labels junction table
CREATE TABLE IF NOT EXISTS participant_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, label_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_labels_event ON labels(event_id);
CREATE INDEX IF NOT EXISTS idx_participant_labels_participant ON participant_labels(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_labels_label ON participant_labels(label_id);

-- Enable Row Level Security
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizers table
-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view own organizer profile" ON organizers;
CREATE POLICY "Users can view own organizer profile" ON organizers
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own organizer profile" ON organizers;
CREATE POLICY "Users can update own organizer profile" ON organizers
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own organizer profile" ON organizers;
CREATE POLICY "Users can insert own organizer profile" ON organizers
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for events table
DROP POLICY IF EXISTS "Organizers can view own events" ON events;
CREATE POLICY "Organizers can view own events" ON events
  FOR SELECT USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizers can create events" ON events;
CREATE POLICY "Organizers can create events" ON events
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizers can update own events" ON events;
CREATE POLICY "Organizers can update own events" ON events
  FOR UPDATE USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizers can delete own events" ON events;
CREATE POLICY "Organizers can delete own events" ON events
  FOR DELETE USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Public can view event details" ON events;
CREATE POLICY "Public can view event details" ON events
  FOR SELECT USING (true);

-- RLS Policies for participants table
DROP POLICY IF EXISTS "Anyone can signup as participant" ON participants;
CREATE POLICY "Anyone can signup as participant" ON participants
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Organizers can view event participants" ON participants;
CREATE POLICY "Organizers can view event participants" ON participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = participants.event_id
      AND events.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can update event participants" ON participants;
CREATE POLICY "Organizers can update event participants" ON participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = participants.event_id
      AND events.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can delete event participants" ON participants;
CREATE POLICY "Organizers can delete event participants" ON participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = participants.event_id
      AND events.organizer_id = auth.uid()
    )
  );

-- RLS Policies for labels table
DROP POLICY IF EXISTS "Organizers can view event labels" ON labels;
CREATE POLICY "Organizers can view event labels" ON labels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = labels.event_id
      AND events.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can create event labels" ON labels;
CREATE POLICY "Organizers can create event labels" ON labels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = labels.event_id
      AND events.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can update event labels" ON labels;
CREATE POLICY "Organizers can update event labels" ON labels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = labels.event_id
      AND events.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can delete event labels" ON labels;
CREATE POLICY "Organizers can delete event labels" ON labels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = labels.event_id
      AND events.organizer_id = auth.uid()
    )
  );

-- RLS Policies for participant_labels table
DROP POLICY IF EXISTS "Organizers can view participant labels" ON participant_labels;
CREATE POLICY "Organizers can view participant labels" ON participant_labels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM participants p
      JOIN events e ON e.id = p.event_id
      WHERE p.id = participant_labels.participant_id
      AND e.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can create participant labels" ON participant_labels;
CREATE POLICY "Organizers can create participant labels" ON participant_labels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM participants p
      JOIN events e ON e.id = p.event_id
      WHERE p.id = participant_labels.participant_id
      AND e.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can delete participant labels" ON participant_labels;
CREATE POLICY "Organizers can delete participant labels" ON participant_labels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM participants p
      JOIN events e ON e.id = p.event_id
      WHERE p.id = participant_labels.participant_id
      AND e.organizer_id = auth.uid()
    )
  );

-- Function to automatically create organizer profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.organizers (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
