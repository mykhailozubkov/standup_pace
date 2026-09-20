PRAGMA foreign_keys = ON;

-- A quiz is a reusable room-owned template. Game sessions and their immutable
-- question snapshots are introduced separately so editing a template can never
-- rewrite completed game history.
CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'archived')),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  archived_at INTEGER,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  CHECK (
    (status = 'draft' AND archived_at IS NULL)
    OR
    (status = 'archived' AND archived_at IS NOT NULL)
  )
);

CREATE INDEX quizzes_active_by_room
  ON quizzes(room_id, updated_at DESC)
  WHERE status = 'draft';

CREATE TABLE quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 50),
  prompt TEXT NOT NULL CHECK (length(trim(prompt)) BETWEEN 1 AND 300),
  time_limit_seconds INTEGER NOT NULL DEFAULT 20
    CHECK (time_limit_seconds BETWEEN 5 AND 120),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  UNIQUE (quiz_id, position)
);

CREATE INDEX quiz_questions_by_quiz
  ON quiz_questions(quiz_id, position);

CREATE TABLE quiz_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 160),
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  UNIQUE (question_id, position)
);

-- The application requires one correct answer. This index also enforces that
-- a malformed write can never mark more than one option as correct.
CREATE UNIQUE INDEX quiz_options_one_correct
  ON quiz_options(question_id)
  WHERE is_correct = 1;

CREATE INDEX quiz_options_by_question
  ON quiz_options(question_id, position);
