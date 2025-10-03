-- Migration to remove foreign key constraint on train_conductor in vip_selections table
-- Date: 2025-01-20
-- Reason: System now allows anyone to be a conductor, not just alliance leaders

-- Drop the foreign key constraint on train_conductor
ALTER TABLE vip_selections 
DROP CONSTRAINT IF EXISTS vip_selections_train_conductor_fkey;

-- Add comment to explain the change
COMMENT ON COLUMN vip_selections.train_conductor IS 'Train conductor name (can be any player, not just alliance leaders)';
