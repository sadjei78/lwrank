-- Season Ranking System Migration
-- Adds tables for Kudos Points and Season Rankings

-- Kudos Points Table
CREATE TABLE IF NOT EXISTS kudos_points (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name text NOT NULL,
    points integer NOT NULL CHECK (points >= 1 AND points <= 10),
    awarded_by text NOT NULL,
    date_awarded date NOT NULL DEFAULT CURRENT_DATE,
    reason text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Season Rankings Cache Table
CREATE TABLE IF NOT EXISTS season_rankings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    player_name text NOT NULL,
    is_eligible boolean NOT NULL DEFAULT true,
    kudos_score decimal(5,2),
    vs_performance_score decimal(5,2),
    special_events_score decimal(5,2),
    alliance_contribution_score decimal(5,2),
    total_weighted_score decimal(5,2),
    final_rank integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kudos_points_player_name ON kudos_points(player_name);
CREATE INDEX IF NOT EXISTS idx_kudos_points_date_awarded ON kudos_points(date_awarded);
CREATE INDEX IF NOT EXISTS idx_kudos_points_awarded_by ON kudos_points(awarded_by);

CREATE INDEX IF NOT EXISTS idx_season_rankings_season_name ON season_rankings(season_name);
CREATE INDEX IF NOT EXISTS idx_season_rankings_player_name ON season_rankings(player_name);
CREATE INDEX IF NOT EXISTS idx_season_rankings_dates ON season_rankings(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_season_rankings_eligible ON season_rankings(is_eligible);
CREATE INDEX IF NOT EXISTS idx_season_rankings_final_rank ON season_rankings(final_rank);

-- Add unique constraint to prevent duplicate kudos for same player on same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_kudos_points_unique_player_date 
ON kudos_points(player_name, date_awarded);

-- Add unique constraint to prevent duplicate season rankings for same player in same season
CREATE UNIQUE INDEX IF NOT EXISTS idx_season_rankings_unique_player_season 
ON season_rankings(player_name, season_name, start_date, end_date);

-- Add RLS policies for kudos_points
ALTER TABLE kudos_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on kudos_points" ON kudos_points
FOR ALL USING (true);

-- Add RLS policies for season_rankings
ALTER TABLE season_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on season_rankings" ON season_rankings
FOR ALL USING (true);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to update updated_at
CREATE TRIGGER update_kudos_points_updated_at 
    BEFORE UPDATE ON kudos_points 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_season_rankings_updated_at 
    BEFORE UPDATE ON season_rankings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
