ALTER TABLE quiz_games ADD COLUMN show_standings INTEGER NOT NULL DEFAULT 0
  CHECK (show_standings IN (0, 1));
