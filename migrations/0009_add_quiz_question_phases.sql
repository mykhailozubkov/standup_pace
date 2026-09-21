ALTER TABLE quiz_games ADD COLUMN question_phase TEXT NOT NULL DEFAULT 'lobby'
  CHECK (question_phase IN ('lobby', 'question', 'reveal', 'complete'));

ALTER TABLE quiz_games ADD COLUMN question_closed_at INTEGER;

UPDATE quiz_games
SET question_phase = CASE status
  WHEN 'waiting' THEN 'lobby'
  WHEN 'active' THEN 'question'
  ELSE 'complete'
END;
