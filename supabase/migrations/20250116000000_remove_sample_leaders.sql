-- Remove sample alliance leaders and train conductor rotation data
-- These were inserted as examples and should be removed for production use

-- Remove sample train conductor rotation entries
DELETE FROM train_conductor_rotation 
WHERE player_name IN ('Leader1', 'Leader2', 'Leader3', 'Leader4', 'Leader5');

-- Remove sample alliance leaders
DELETE FROM alliance_leaders 
WHERE player_name IN ('Leader1', 'Leader2', 'Leader3', 'Leader4', 'Leader5');
