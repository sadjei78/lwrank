/*
  # Update rankings table to use dates instead of days

  1. Changes
    - Add `date` column (YYYY-MM-DD format)
    - Keep `day` column for backward compatibility
    - Update indexes to use date column
    - Add constraint to ensure date format

  2. Migration Strategy
    - Add new column without breaking existing data
    - Update indexes for better performance with date queries
*/

-- Add date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rankings' AND column_name = 'date'
  ) THEN
    ALTER TABLE rankings ADD COLUMN date text;
  END IF;
END $$;

-- Add index on date column for efficient queries
CREATE INDEX IF NOT EXISTS idx_rankings_date ON rankings(date);
CREATE INDEX IF NOT EXISTS idx_rankings_date_ranking ON rankings(date, ranking);

-- Add unique constraint for date and ranking combination
DROP INDEX IF EXISTS idx_rankings_day_ranking_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rankings_date_ranking_unique ON rankings(date, ranking);

-- Add check constraint to ensure date format (YYYY-MM-DD)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'rankings_date_format_check'
  ) THEN
    ALTER TABLE rankings ADD CONSTRAINT rankings_date_format_check 
    CHECK (date IS NULL OR date ~ '^\d{4}-\d{2}-\d{2}$');
  END IF;
END $$;