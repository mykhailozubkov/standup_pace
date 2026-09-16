PRAGMA foreign_keys = ON;

-- Application profiles use the same user_id as the authentication provider.
-- Better Auth tables will be generated in the next migration when authentication
-- is replaced; keeping profile data separate prevents auth-library schema changes
-- from leaking into the application model.
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
    CHECK (length(trim(display_name)) BETWEEN 1 AND 80),
  locale TEXT NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'ru')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(trim(name)) BETWEEN 1 AND 120),
  join_code TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(join_code) BETWEEN 4 AND 12),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  default_talk_limit_seconds INTEGER NOT NULL DEFAULT 120
    CHECK (default_talk_limit_seconds BETWEEN 15 AND 3600),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  archived_at INTEGER,
  FOREIGN KEY (owner_user_id) REFERENCES user_profiles(user_id) ON DELETE RESTRICT
);

CREATE TABLE room_members (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  removed_at INTEGER,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX room_members_one_active_owner
  ON room_members(room_id)
  WHERE role = 'owner' AND removed_at IS NULL;

CREATE INDEX rooms_by_owner
  ON rooms(owner_user_id, status, updated_at DESC);

CREATE INDEX room_members_by_user
  ON room_members(user_id, removed_at, joined_at DESC);

CREATE INDEX room_members_active_by_room
  ON room_members(room_id, role, joined_at)
  WHERE removed_at IS NULL;
