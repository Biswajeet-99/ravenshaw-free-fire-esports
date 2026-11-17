-- Ravenshaw Free Fire Esports tournament schema (MySQL)

CREATE TABLE IF NOT EXISTS squads (
  slot SMALLINT PRIMARY KEY,
  team_name VARCHAR(120) NOT NULL,
  captain_name VARCHAR(120) NOT NULL,
  department VARCHAR(120) NOT NULL,
  whatsapp VARCHAR(120) NOT NULL,
  player1 VARCHAR(120) NOT NULL,
  player2 VARCHAR(120) NOT NULL,
  player3 VARCHAR(120) NOT NULL,
  player4 VARCHAR(120) NOT NULL,
  substitute VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (slot BETWEEN 1 AND 12),
  CHECK (CHAR_LENGTH(TRIM(team_name)) BETWEEN 1 AND 120),
  CHECK (CHAR_LENGTH(TRIM(captain_name)) BETWEEN 1 AND 120),
  CHECK (CHAR_LENGTH(TRIM(department)) BETWEEN 1 AND 120),
  CHECK (CHAR_LENGTH(TRIM(whatsapp)) BETWEEN 1 AND 120),
  CHECK (CHAR_LENGTH(TRIM(player1)) BETWEEN 1 AND 120),
  CHECK (CHAR_LENGTH(TRIM(player2)) BETWEEN 1 AND 120),
  CHECK (CHAR_LENGTH(TRIM(player3)) BETWEEN 1 AND 120),
  CHECK (CHAR_LENGTH(TRIM(player4)) BETWEEN 1 AND 120)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS match_scores (
  slot SMALLINT NOT NULL,
  match_number SMALLINT NOT NULL,
  placement SMALLINT NOT NULL,
  kills INT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (slot, match_number),
  CONSTRAINT fk_match_scores_slot
    FOREIGN KEY (slot) REFERENCES squads(slot)
    ON DELETE CASCADE,
  CHECK (match_number BETWEEN 1 AND 5),
  CHECK (placement BETWEEN 1 AND 12),
  CHECK (kills >= 0)
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS idx_match_scores_slot ON match_scores(slot);
CREATE INDEX IF NOT EXISTS idx_match_scores_match_number ON match_scores(match_number);

-- Open slots are represented by the absence of a squads row. The API expands
-- these into all 12 slots for clients, so no fabricated team seed data is used.
-- Optional example registration (replace all sample values before running):
-- INSERT INTO squads (slot, team_name, captain_name, department, whatsapp, player1, player2, player3, player4)
-- VALUES (1, 'Sample Squad', 'Captain', 'Department', '0000000000', 'Player 1', 'Player 2', 'Player 3', 'Player 4');
