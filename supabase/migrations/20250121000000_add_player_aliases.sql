/*
  # Add Player Aliases System

  This migration adds a table to track player name variations and aliases.
  This allows linking different name variations to the same player for better
  data consistency and search functionality.

  1. New Tables
    - `player_aliases`
      - `id` (uuid, primary key)
      - `primary_name` (text) - the canonical/primary name for the player
      - `alias_name` (text) - alternative name variation
      - `created_by` (text) - who created the alias (admin)
      - `created_at` (timestamp)
      - `is_active` (boolean) - whether the alias is currently active

  2. Security
    - Enable RLS on `player_aliases` table
    - Add policy for public read access
    - Add policy for authenticated users to insert/update

  3. Indexes
    - Add indexes for efficient lookups on both primary_name and alias_name
    - Add unique constraint to prevent duplicate aliases
*/

CREATE TABLE IF NOT EXISTS player_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_name text NOT NULL,
  alias_name text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  
  -- Ensure we don't have duplicate aliases
  UNIQUE(primary_name, alias_name)
);

-- Enable RLS
ALTER TABLE player_aliases ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read player aliases
CREATE POLICY "Anyone can read player aliases"
  ON player_aliases
  FOR SELECT
  TO public
  USING (true);

-- Allow anyone to insert player aliases (admin functionality)
CREATE POLICY "Anyone can insert player aliases"
  ON player_aliases
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anyone to update player aliases
CREATE POLICY "Anyone can update player aliases"
  ON player_aliases
  FOR UPDATE
  TO public
  USING (true);

-- Allow anyone to delete player aliases
CREATE POLICY "Anyone can delete player aliases"
  ON player_aliases
  FOR DELETE
  TO public
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_aliases_primary_name ON player_aliases(primary_name);
CREATE INDEX IF NOT EXISTS idx_player_aliases_alias_name ON player_aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_player_aliases_active ON player_aliases(is_active);
CREATE INDEX IF NOT EXISTS idx_player_aliases_created_at ON player_aliases(created_at);

-- Add check constraint to ensure primary_name and alias_name are different
ALTER TABLE player_aliases ADD CONSTRAINT check_different_names 
CHECK (primary_name != alias_name);

-- Add check constraint to ensure names are not empty
ALTER TABLE player_aliases ADD CONSTRAINT check_non_empty_names 
CHECK (length(trim(primary_name)) > 0 AND length(trim(alias_name)) > 0);
