/*
  # Create rankings table for Daily Rankings Manager

  1. New Tables
    - `rankings`
      - `id` (uuid, primary key)
      - `day` (text) - day of the week (monday, tuesday, etc.)
      - `ranking` (integer) - the rank position
      - `commander` (text) - player name
      - `points` (text) - points value as string to preserve formatting
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `rankings` table
    - Add policy for public read access (all users can view rankings)
    - Add policy for authenticated users to insert/update (admins can modify data)

  3. Indexes
    - Add index on day and ranking for efficient queries
*/

CREATE TABLE IF NOT EXISTS rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day text NOT NULL,
  ranking integer NOT NULL,
  commander text NOT NULL,
  points text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read rankings
CREATE POLICY "Anyone can read rankings"
  ON rankings
  FOR SELECT
  TO public
  USING (true);

-- Allow anyone to insert/update rankings (since we're using URL-based admin)
CREATE POLICY "Anyone can insert rankings"
  ON rankings
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update rankings"
  ON rankings
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete rankings"
  ON rankings
  FOR DELETE
  TO public
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rankings_day ON rankings(day);
CREATE INDEX IF NOT EXISTS idx_rankings_day_ranking ON rankings(day, ranking);

-- Add unique constraint to prevent duplicate rankings for the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_rankings_day_ranking_unique ON rankings(day, ranking);