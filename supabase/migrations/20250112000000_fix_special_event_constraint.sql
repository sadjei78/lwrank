/*
  # Fix unique constraint for special events

  The current constraint idx_rankings_date_ranking_unique prevents multiple special events
  from having the same ranking numbers when they start on the same date. We need to change
  this to use the day field instead, which contains the unique event key.

  Changes:
  - Drop the current unique constraint on (date, ranking)
  - Create a new unique constraint on (day, ranking)
  - This allows special events to have their own unique ranking space
*/

-- Drop the current unique constraint that uses date field
DROP INDEX IF EXISTS idx_rankings_date_ranking_unique;

-- Create new unique constraint using day field instead
CREATE UNIQUE INDEX IF NOT EXISTS idx_rankings_day_ranking_unique ON rankings(day, ranking);

-- Keep the date format check constraint as is
-- (This ensures date field still follows YYYY-MM-DD format)
