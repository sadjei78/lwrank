/*
  # Add pinned field to special events

  This migration adds a pinned field to the special_events table to allow
  certain events to be pinned and displayed regardless of the selected week.

  Changes:
  - Add `pinned` column (boolean) to special_events table
  - Default value is false
  - Add index for efficient pinned event queries
*/

-- Add pinned column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'special_events' AND column_name = 'pinned'
  ) THEN
    ALTER TABLE special_events ADD COLUMN pinned boolean DEFAULT false;
  END IF;
END $$;

-- Add index on pinned column for efficient queries
CREATE INDEX IF NOT EXISTS idx_special_events_pinned ON special_events(pinned);
