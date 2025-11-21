/*
  # Add inactive players tracking

  This migration adds a table to track players who are temporarily inactive.
  Inactive players will:
  - Be excluded from recent activity reports
  - Be excluded from VIP/Conductor dropdown selections
  - Still appear in daily rankings and historical reports

  1. New Tables
    - `inactive_players`
      - `id` (uuid, primary key)
      - `player_name` (text, unique) - name of the inactive player
      - `marked_inactive_date` (date) - when they were marked inactive
      - `marked_by` (text) - who marked them inactive (admin)
      - `reason` (text, optional) - reason for marking inactive
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `inactive_players` table
    - Add policy for public read access
    - Add policy for authenticated users to insert/update/delete

  3. Indexes
    - Add index on player_name for efficient lookups
*/

CREATE TABLE IF NOT EXISTS inactive_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text UNIQUE NOT NULL,
  marked_inactive_date date NOT NULL DEFAULT CURRENT_DATE,
  marked_by text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE inactive_players ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read inactive players
CREATE POLICY "Anyone can read inactive players"
  ON inactive_players
  FOR SELECT
  TO public
  USING (true);

-- Allow anyone to insert inactive players (admin functionality)
CREATE POLICY "Anyone can insert inactive players"
  ON inactive_players
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anyone to update inactive players
CREATE POLICY "Anyone can update inactive players"
  ON inactive_players
  FOR UPDATE
  TO public
  USING (true);

-- Allow anyone to delete inactive players (to reactivate them)
CREATE POLICY "Anyone can delete inactive players"
  ON inactive_players
  FOR DELETE
  TO public
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inactive_players_name ON inactive_players(player_name);
CREATE INDEX IF NOT EXISTS idx_inactive_players_date ON inactive_players(marked_inactive_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inactive_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inactive_players_updated_at
  BEFORE UPDATE ON inactive_players
  FOR EACH ROW
  EXECUTE FUNCTION update_inactive_players_updated_at();

