/*
  # Insert R4R5 Alliance Leaders (Data Only)
  
  This migration inserts the alliance leader names into the existing r4r5_leaders table.
  These leaders can be used for future features and special handling.
*/

INSERT INTO r4r5_leaders (id, name, key, created) VALUES
  (gen_random_uuid(), 'Beanie Baby27', 'beanie_baby27', now()),
  (gen_random_uuid(), 'TDubs31', 'tdubs31', now()),
  (gen_random_uuid(), 'Infectious19', 'infectious19', now()),
  (gen_random_uuid(), 'XxSoloxX你最愛的', 'xxsoloxx', now()),
  (gen_random_uuid(), 'TheGambit1', 'thegambit1', now()),
  (gen_random_uuid(), 'sHåfT', 'shaft', now()),
  (gen_random_uuid(), '74Mobdingo', '74mobdingo', now()),
  (gen_random_uuid(), 'I AM GOrr', 'i_am_gorr', now()),
  (gen_random_uuid(), 'BaconC', 'baconc', now()),
  (gen_random_uuid(), 'SpLTnYOwiG', 'spltyowig', now())
ON CONFLICT (key) DO NOTHING; -- Skip if key already exists
