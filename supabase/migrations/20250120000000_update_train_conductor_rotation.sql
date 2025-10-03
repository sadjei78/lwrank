-- Migration to update train conductor rotation table for manual conductor selection and multiple trains per day
-- Date: 2025-01-20

-- Add new fields to train_conductor_rotation table
ALTER TABLE train_conductor_rotation 
ADD COLUMN IF NOT EXISTS conductor_name TEXT,
ADD COLUMN IF NOT EXISTS train_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS train_time TIME DEFAULT '04:00:00';

-- Add comment to explain the new fields
COMMENT ON COLUMN train_conductor_rotation.conductor_name IS 'Manually selected conductor name (replaces automatic rotation)';
COMMENT ON COLUMN train_conductor_rotation.train_date IS 'Date of the train ride';
COMMENT ON COLUMN train_conductor_rotation.train_time IS 'Time of day for the train (04:00, 12:00, 20:00 for multiple trains per day)';

-- Update existing records to have default train date and time
UPDATE train_conductor_rotation 
SET train_date = CURRENT_DATE,
    train_time = '04:00:00' 
WHERE train_date IS NULL OR train_time IS NULL;

-- Create index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_train_conductor_rotation_date_time 
ON train_conductor_rotation(train_date, train_time);

-- Update RLS policies if needed (keeping existing policies)
-- The existing policies should work with the new fields since they're just additional data
