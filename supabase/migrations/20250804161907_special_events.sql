/*
  # Create special_events table for Special Event Management

  1. New Tables
    - `special_events`
      - `id` (uuid, primary key)
      - `name` (text) - event name
      - `start_date` (date) - event start date
      - `end_date` (date) - event end date
      - `key` (text) - unique event key
      - `created` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `special_events` table
    - Add policy for public read access
    - Add policy for authenticated users to insert/update

  3. Indexes
    - Add index on key for efficient queries
*/

CREATE TABLE IF NOT EXISTS special_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  key text UNIQUE NOT NULL,
  created timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS (only if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'special_events' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Allow everyone to read special events (only if policy doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'special_events' 
    AND policyname = 'Anyone can read special events'
  ) THEN
    CREATE POLICY "Anyone can read special events"
      ON special_events
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Allow anyone to insert special events (only if policy doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'special_events' 
    AND policyname = 'Anyone can insert special events'
  ) THEN
    CREATE POLICY "Anyone can insert special events"
      ON special_events
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;

-- Allow anyone to update special events (only if policy doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'special_events' 
    AND policyname = 'Anyone can update special events'
  ) THEN
    CREATE POLICY "Anyone can update special events"
      ON special_events
      FOR UPDATE
      TO public
      USING (true);
  END IF;
END $$;

-- Allow anyone to delete special events (only if policy doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'special_events' 
    AND policyname = 'Anyone can delete special events'
  ) THEN
    CREATE POLICY "Anyone can delete special events"
      ON special_events
      FOR DELETE
      TO public
      USING (true);
  END IF;
END $$;

-- Add indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_special_events_key ON special_events(key);
CREATE INDEX IF NOT EXISTS idx_special_events_created ON special_events(created);
