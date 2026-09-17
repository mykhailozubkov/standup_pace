PRAGMA foreign_keys = ON;

-- A room is a long-lived team workspace. Each call is represented by a
-- separate meeting so timer data and history can be scoped to one standup.
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  talk_limit_seconds INTEGER NOT NULL
    CHECK (talk_limit_seconds BETWEEN 15 AND 3600),
  started_by_user_id TEXT NOT NULL,
  ended_by_user_id TEXT,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  ended_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (started_by_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (ended_by_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  CHECK (
    (status = 'active' AND ended_at IS NULL AND ended_by_user_id IS NULL)
    OR
    (status = 'completed' AND ended_at IS NOT NULL AND ended_by_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX meetings_one_active_per_room
  ON meetings(room_id)
  WHERE status = 'active';

CREATE INDEX meetings_history_by_room
  ON meetings(room_id, started_at DESC);
