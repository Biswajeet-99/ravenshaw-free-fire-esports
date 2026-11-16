-- Ravenshaw Free Fire Esports tournament schema (PostgreSQL / Supabase)

CREATE TABLE IF NOT EXISTS squads (
  slot SMALLINT PRIMARY KEY CHECK (slot BETWEEN 1 AND 12),
  team_name TEXT NOT NULL CHECK (char_length(trim(team_name)) BETWEEN 1 AND 120),
  captain_name TEXT NOT NULL CHECK (char_length(trim(captain_name)) BETWEEN 1 AND 120),
  department TEXT NOT NULL CHECK (char_length(trim(department)) BETWEEN 1 AND 120),
  whatsapp TEXT NOT NULL CHECK (char_length(trim(whatsapp)) BETWEEN 1 AND 120),
  player1 TEXT NOT NULL CHECK (char_length(trim(player1)) BETWEEN 1 AND 120),
  player2 TEXT NOT NULL CHECK (char_length(trim(player2)) BETWEEN 1 AND 120),
  player3 TEXT NOT NULL CHECK (char_length(trim(player3)) BETWEEN 1 AND 120),
  player4 TEXT NOT NULL CHECK (char_length(trim(player4)) BETWEEN 1 AND 120),
  substitute TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_scores (
  slot SMALLINT NOT NULL REFERENCES squads(slot) ON DELETE CASCADE,
  match_number SMALLINT NOT NULL CHECK (match_number BETWEEN 1 AND 5),
  placement SMALLINT NOT NULL CHECK (placement BETWEEN 1 AND 12),
  kills INTEGER NOT NULL CHECK (kills >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT match_scores_slot_match_unique UNIQUE (slot, match_number)
);

CREATE INDEX IF NOT EXISTS match_scores_match_number_idx ON match_scores(match_number);

-- Open slots are represented by the absence of a squads row. The API expands
-- these into all 12 slots for clients, so no fabricated team seed data is used.
-- Optional example registration (replace all sample values before running):
-- INSERT INTO squads (slot, team_name, captain_name, department, whatsapp, player1, player2, player3, player4)
-- VALUES (1, 'Sample Squad', 'Captain', 'Department', '0000000000', 'Player 1', 'Player 2', 'Player 3', 'Player 4');
