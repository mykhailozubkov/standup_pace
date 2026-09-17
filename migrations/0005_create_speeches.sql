PRAGMA foreign_keys = ON;

-- Every speaker turn belongs to one occurrence of a recurring standup.
-- accumulated_seconds stores completed running segments; resumed_at marks the
-- beginning of the current segment while the timer is running.
CREATE TABLE speeches (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  speaker_user_id TEXT NOT NULL,
  started_by_user_id TEXT NOT NULL,
  ended_by_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused', 'completed')),
  talk_limit_seconds INTEGER NOT NULL
    CHECK (talk_limit_seconds BETWEEN 15 AND 3600),
  accumulated_seconds INTEGER NOT NULL DEFAULT 0
    CHECK (accumulated_seconds >= 0),
  resumed_at INTEGER,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  ended_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (speaker_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (started_by_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (ended_by_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  CHECK (
    (status = 'running' AND resumed_at IS NOT NULL AND ended_at IS NULL AND ended_by_user_id IS NULL)
    OR
    (status = 'paused' AND resumed_at IS NULL AND ended_at IS NULL AND ended_by_user_id IS NULL)
    OR
    (status = 'completed' AND resumed_at IS NULL AND ended_at IS NOT NULL AND ended_by_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX speeches_one_open_per_meeting
  ON speeches(meeting_id)
  WHERE status IN ('running', 'paused');

CREATE INDEX speeches_history_by_meeting
  ON speeches(meeting_id, started_at DESC);
