-- Create excused_players table
CREATE TABLE IF NOT EXISTS excused_players (
    id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    date_excused DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_excused_players_player_name ON excused_players(player_name);
CREATE INDEX IF NOT EXISTS idx_excused_players_date_excused ON excused_players(date_excused);

-- Add RLS policies
ALTER TABLE excused_players ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON excused_players
    FOR ALL USING (true);
