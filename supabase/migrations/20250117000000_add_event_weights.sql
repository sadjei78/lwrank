-- Add weight field to special_events table for weighted scoring
-- This weight represents what percentage of the overall player score this event contributes

ALTER TABLE special_events 
ADD COLUMN IF NOT EXISTS event_weight DECIMAL(5,2) DEFAULT 10.00 
CHECK (event_weight >= 0 AND event_weight <= 100);

-- Add comment to explain the weight field
COMMENT ON COLUMN special_events.event_weight IS 'Weight percentage (0-100) representing how much this event contributes to overall season ranking score';

-- Update existing events to have a default weight of 10%
UPDATE special_events 
SET event_weight = 10.00 
WHERE event_weight IS NULL;

-- Add index for better performance on weight queries
CREATE INDEX IF NOT EXISTS idx_special_events_weight ON special_events(event_weight);
