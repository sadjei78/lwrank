-- Migration to add composite unique constraint for multiple trains per day
-- Date: 2025-01-20

-- Drop the existing unique constraint on date only
ALTER TABLE vip_selections DROP CONSTRAINT IF EXISTS vip_selections_date_key;

-- Add composite unique constraint on date + train_time
ALTER TABLE vip_selections 
ADD CONSTRAINT vip_selections_date_time_unique 
UNIQUE (date, train_time);

-- Add comment to explain the constraint
COMMENT ON CONSTRAINT vip_selections_date_time_unique ON vip_selections 
IS 'Allows multiple trains per day with different times (04:00, 12:00, 20:00)';
