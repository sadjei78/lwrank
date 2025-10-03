-- Migration to add train_time field to vip_selections table
-- Date: 2025-01-20

-- Add train_time field to vip_selections table for consistency
ALTER TABLE vip_selections 
ADD COLUMN IF NOT EXISTS train_time TIME DEFAULT '04:00:00';

-- Add comment to explain the new field
COMMENT ON COLUMN vip_selections.train_time IS 'Time of day for the train (04:00, 12:00, 20:00 for multiple trains per day)';

-- Update existing records to have default train time
UPDATE vip_selections 
SET train_time = '04:00:00' 
WHERE train_time IS NULL;

-- Create index for better performance on date/time queries
CREATE INDEX IF NOT EXISTS idx_vip_selections_date_time 
ON vip_selections(date, train_time);
