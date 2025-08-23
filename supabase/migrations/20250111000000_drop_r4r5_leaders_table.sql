/*
  # Drop R4R5 Leaders Table (Cleanup)
  
  This migration removes the unused r4r5_leaders table that is no longer needed.
  The current system uses the alliance_leaders table instead.
*/

-- Drop the unused r4r5_leaders table
DROP TABLE IF EXISTS r4r5_leaders;

-- Note: This table was created for legacy purposes but is not used in the current application.
-- The alliance_leaders table provides the same functionality with additional features like active/inactive status.
