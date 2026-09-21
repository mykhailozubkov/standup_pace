PRAGMA foreign_keys = ON;

-- A game is an immutable launch of a reusable quiz template. Questions and
-- options are copied below so later edits never rewrite an active or finished
-- game.
CREATE TABLE quiz_games (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  quiz_id TEXT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'finished', 'cancelled')),
  host_user_id TEXT NOT NULL,
  current_question_position INTEGER NOT NULL DEFAULT 0
    CHECK (current_question_position BETWEEN 0 AND 50),
  question_started_at INTEGER,
  started_at INTEGER,
  finished_at INTEGER,
  cancelled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL,
  FOREIGN KEY (host_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  CHECK (
    (status = 'waiting'
      AND current_question_position = 0
      AND question_started_at IS NULL
      AND started_at IS NULL
      AND finished_at IS NULL
      AND cancelled_at IS NULL)
    OR
    (status = 'active'
      AND current_question_position >= 1
      AND question_started_at IS NOT NULL
      AND started_at IS NOT NULL
      AND finished_at IS NULL
      AND cancelled_at IS NULL)
    OR
    (status = 'finished'
      AND current_question_position >= 1
      AND question_started_at IS NOT NULL
      AND started_at IS NOT NULL
      AND finished_at IS NOT NULL
      AND cancelled_at IS NULL)
    OR
    (status = 'cancelled'
      AND finished_at IS NULL
      AND cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX quiz_games_one_open_per_room
  ON quiz_games(room_id)
  WHERE status IN ('waiting', 'active');

CREATE INDEX quiz_games_history_by_room
  ON quiz_games(room_id, created_at DESC);

CREATE TABLE quiz_game_questions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  source_question_id TEXT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 50),
  prompt TEXT NOT NULL CHECK (length(trim(prompt)) BETWEEN 1 AND 300),
  time_limit_seconds INTEGER NOT NULL CHECK (time_limit_seconds BETWEEN 5 AND 120),
  FOREIGN KEY (game_id) REFERENCES quiz_games(id) ON DELETE CASCADE,
  FOREIGN KEY (source_question_id) REFERENCES quiz_questions(id) ON DELETE SET NULL,
  UNIQUE (id, game_id),
  UNIQUE (game_id, position)
);

CREATE INDEX quiz_game_questions_by_game
  ON quiz_game_questions(game_id, position);

CREATE TABLE quiz_game_options (
  id TEXT PRIMARY KEY,
  game_question_id TEXT NOT NULL,
  source_option_id TEXT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 160),
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  FOREIGN KEY (game_question_id) REFERENCES quiz_game_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL,
  UNIQUE (id, game_question_id),
  UNIQUE (game_question_id, position)
);

CREATE UNIQUE INDEX quiz_game_options_one_correct
  ON quiz_game_options(game_question_id)
  WHERE is_correct = 1;

CREATE INDEX quiz_game_options_by_question
  ON quiz_game_options(game_question_id, position);

CREATE TABLE quiz_game_participants (
  game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  final_rank INTEGER CHECK (final_rank IS NULL OR final_rank >= 1),
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  left_at INTEGER,
  PRIMARY KEY (game_id, user_id),
  FOREIGN KEY (game_id) REFERENCES quiz_games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT
);

CREATE INDEX quiz_game_participants_active
  ON quiz_game_participants(game_id, joined_at)
  WHERE left_at IS NULL;

CREATE TABLE quiz_game_answers (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  game_question_id TEXT NOT NULL,
  participant_user_id TEXT NOT NULL,
  selected_option_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  answered_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (game_id) REFERENCES quiz_games(id) ON DELETE CASCADE,
  FOREIGN KEY (game_question_id, game_id)
    REFERENCES quiz_game_questions(id, game_id) ON DELETE CASCADE,
  FOREIGN KEY (selected_option_id, game_question_id)
    REFERENCES quiz_game_options(id, game_question_id) ON DELETE RESTRICT,
  FOREIGN KEY (game_id, participant_user_id)
    REFERENCES quiz_game_participants(game_id, user_id) ON DELETE CASCADE,
  UNIQUE (game_question_id, participant_user_id)
);

CREATE INDEX quiz_game_answers_by_game
  ON quiz_game_answers(game_id, game_question_id);
