PRAGMA foreign_keys = ON;

-- Tasks are generated and assigned inside a persistent room. Current-call
-- tasks belong to a concrete standup; preparation tasks stay room-scoped.
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  meeting_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('current', 'next')),
  cycle_number INTEGER NOT NULL CHECK (cycle_number >= 1),
  participant_user_id TEXT NOT NULL,
  assigned_by_user_id TEXT NOT NULL,
  task_en TEXT NOT NULL CHECK (length(trim(task_en)) BETWEEN 1 AND 240),
  task_ru TEXT NOT NULL CHECK (length(trim(task_ru)) BETWEEN 1 AND 240),
  model TEXT NOT NULL CHECK (length(trim(model)) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  CHECK (
    (kind = 'current' AND meeting_id IS NOT NULL)
    OR
    (kind = 'next' AND meeting_id IS NULL)
  )
);

CREATE UNIQUE INDEX assignments_current_cycle_participant
  ON assignments(meeting_id, cycle_number, participant_user_id)
  WHERE kind = 'current';

CREATE UNIQUE INDEX assignments_next_cycle_participant
  ON assignments(room_id, cycle_number, participant_user_id)
  WHERE kind = 'next';

CREATE INDEX assignments_history_by_room
  ON assignments(room_id, created_at DESC);

CREATE INDEX assignments_by_participant
  ON assignments(participant_user_id, created_at DESC);
