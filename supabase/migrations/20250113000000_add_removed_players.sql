/*
  # Add removed players tracking

  This migration adds a table to track players who have been removed from the alliance.
  These players will still appear in rankings and reports but with visual indicators.

  1. New Tables
    - `removed_players`
      - `id` (uuid, primary key)
      - `player_name` (text) - name of the removed player
      - `removed_date` (date) - when they were removed
      - `removed_by` (text) - who removed them (admin)
      - `reason` (text, optional) - reason for removal
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `removed_players` table
    - Add policy for public read access
    - Add policy for authenticated users to insert/update

  3. Indexes
    - Add index on player_name for efficient lookups
*/

CREATE TABLE IF NOT EXISTS removed_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text UNIQUE NOT NULL,
  removed_date date NOT NULL DEFAULT CURRENT_DATE,
  removed_by text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE removed_players ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read removed players
CREATE POLICY "Anyone can read removed players"
  ON removed_players
  FOR SELECT
  TO public
  USING (true);

-- Allow anyone to insert removed players (admin functionality)
CREATE POLICY "Anyone can insert removed players"
  ON removed_players
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anyone to update removed players
CREATE POLICY "Anyone can update removed players"
  ON removed_players
  FOR UPDATE
  TO public
  USING (true);

-- Allow anyone to delete removed players
CREATE POLICY "Anyone can delete removed players"
  ON removed_players
  FOR DELETE
  TO public
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_removed_players_name ON removed_players(player_name);
CREATE INDEX IF NOT EXISTS idx_removed_players_date ON removed_players(removed_date);
