-- Create table for alliance leaders
CREATE TABLE IF NOT EXISTS alliance_leaders (
    id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for train conductor rotation
CREATE TABLE IF NOT EXISTS train_conductor_rotation (
    id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL REFERENCES alliance_leaders(player_name),
    rotation_order INTEGER NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for VIP selections
CREATE TABLE IF NOT EXISTS vip_selections (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    train_conductor TEXT NOT NULL REFERENCES alliance_leaders(player_name),
    vip_player TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_vip_selections_date ON vip_selections(date);
CREATE INDEX IF NOT EXISTS idx_train_conductor_rotation_order ON train_conductor_rotation(rotation_order);

-- Insert some sample alliance leaders (you can modify these)
INSERT INTO alliance_leaders (player_name) VALUES 
    ('Leader1'),
    ('Leader2'),
    ('Leader3'),
    ('Leader4'),
    ('Leader5')
ON CONFLICT (player_name) DO NOTHING;

-- Insert sample train conductor rotation (you can modify the order)
INSERT INTO train_conductor_rotation (player_name, rotation_order) VALUES 
    ('Leader1', 1),
    ('Leader2', 2),
    ('Leader3', 3),
    ('Leader4', 4),
    ('Leader5', 5)
ON CONFLICT (rotation_order) DO NOTHING;
