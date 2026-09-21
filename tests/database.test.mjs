import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

const migrationUrl = new URL("../migrations/0001_create_rooms.sql", import.meta.url);
const authMigrationUrl = new URL("../migrations/0002_add_better_auth.sql", import.meta.url);
const rateLimitMigrationUrl = new URL("../migrations/0003_add_auth_rate_limit.sql", import.meta.url);
const meetingMigrationUrl = new URL("../migrations/0004_create_meetings.sql", import.meta.url);
const speechMigrationUrl = new URL("../migrations/0005_create_speeches.sql", import.meta.url);
const assignmentMigrationUrl = new URL("../migrations/0006_create_assignments.sql", import.meta.url);
const quizMigrationUrl = new URL("../migrations/0007_create_quizzes.sql", import.meta.url);
const quizGameMigrationUrl = new URL("../migrations/0008_create_quiz_games.sql", import.meta.url);
const quizQuestionPhaseMigrationUrl = new URL("../migrations/0009_add_quiz_question_phases.sql", import.meta.url);

test("the initial D1 migration creates the room data model", async () => {
  const database = new DatabaseSync(":memory:");
  const migration = await readFile(migrationUrl, "utf8");

  database.exec(migration);

  const tables = database.prepare(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map(({ name }) => name);

  assert.deepEqual(tables, ["room_members", "rooms", "user_profiles"]);

  const indexes = database.prepare(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map(({ name }) => name);

  assert.deepEqual(indexes, [
    "room_members_active_by_room",
    "room_members_by_user",
    "room_members_one_active_owner",
    "rooms_by_owner",
  ]);
});

test("the room model enforces ownership and room constraints", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(migrationUrl, "utf8"));

  const insertProfile = database.prepare(`
    INSERT INTO user_profiles (user_id, display_name)
    VALUES (?, ?)
  `);
  insertProfile.run("user-1", "Ada");
  insertProfile.run("user-2", "Linus");

  database.prepare(`
    INSERT INTO rooms (id, owner_user_id, name, join_code)
    VALUES (?, ?, ?, ?)
  `).run("room-1", "user-1", "Daily standup", "TEAM42");

  database.prepare(`
    INSERT INTO room_members (room_id, user_id, role)
    VALUES (?, ?, 'owner')
  `).run("room-1", "user-1");

  assert.throws(() => database.prepare(`
    INSERT INTO rooms (id, owner_user_id, name, join_code)
    VALUES (?, ?, ?, ?)
  `).run("room-2", "missing-user", "Invalid", "BAD42"), /FOREIGN KEY/);

  assert.throws(() => database.prepare(`
    INSERT INTO room_members (room_id, user_id, role)
    VALUES (?, ?, 'owner')
  `).run("room-1", "user-2"), /UNIQUE/);

  assert.throws(() => database.prepare(`
    INSERT INTO rooms (id, owner_user_id, name, join_code, default_talk_limit_seconds)
    VALUES (?, ?, ?, ?, ?)
  `).run("room-3", "user-1", "Invalid limit", "BAD43", 5), /CHECK/);
});

test("the Better Auth migration creates auth tables and synchronizes profiles", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(migrationUrl, "utf8"));
  database.exec(await readFile(authMigrationUrl, "utf8"));
  database.exec(await readFile(rateLimitMigrationUrl, "utf8"));

  const tables = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name IN ('user', 'session', 'account', 'verification', 'rateLimit')
    ORDER BY name
  `).all().map(({ name }) => name);
  assert.deepEqual(tables, ["account", "rateLimit", "session", "user", "verification"]);

  database.prepare(`
    INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run("auth-user-1", "Grace", "grace@example.com");
  assert.equal(
    database.prepare("SELECT display_name FROM user_profiles WHERE user_id = ?").get("auth-user-1").display_name,
    "Grace",
  );

  database.prepare('UPDATE "user" SET name = ? WHERE id = ?').run("Grace Hopper", "auth-user-1");
  assert.equal(
    database.prepare("SELECT display_name FROM user_profiles WHERE user_id = ?").get("auth-user-1").display_name,
    "Grace Hopper",
  );
});

test("the meeting migration models recurring standups inside a persistent room", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(migrationUrl, "utf8"));
  database.exec(await readFile(meetingMigrationUrl, "utf8"));

  database.prepare(`
    INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)
  `).run("user-1", "Ada");
  database.prepare(`
    INSERT INTO rooms (id, owner_user_id, name, join_code)
    VALUES (?, ?, ?, ?)
  `).run("room-1", "user-1", "Platform", "ROOM42");

  database.prepare(`
    INSERT INTO meetings (id, room_id, talk_limit_seconds, started_by_user_id)
    VALUES (?, ?, ?, ?)
  `).run("meeting-1", "room-1", 120, "user-1");

  assert.throws(() => database.prepare(`
    INSERT INTO meetings (id, room_id, talk_limit_seconds, started_by_user_id)
    VALUES (?, ?, ?, ?)
  `).run("meeting-2", "room-1", 120, "user-1"), /UNIQUE/);

  database.prepare(`
    UPDATE meetings
    SET status = 'completed', ended_by_user_id = ?, ended_at = unixepoch()
    WHERE id = ?
  `).run("user-1", "meeting-1");
  database.prepare(`
    INSERT INTO meetings (id, room_id, talk_limit_seconds, started_by_user_id)
    VALUES (?, ?, ?, ?)
  `).run("meeting-2", "room-1", 120, "user-1");

  assert.throws(() => database.prepare(`
    UPDATE meetings SET status = 'completed' WHERE id = ?
  `).run("meeting-2"), /CHECK/);

  const indexes = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'index' AND name LIKE 'meetings_%'
    ORDER BY name
  `).all().map(({ name }) => name);
  assert.deepEqual(indexes, ["meetings_history_by_room", "meetings_one_active_per_room"]);
});

test("the speech migration models resumable speaker turns", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(migrationUrl, "utf8"));
  database.exec(await readFile(meetingMigrationUrl, "utf8"));
  database.exec(await readFile(speechMigrationUrl, "utf8"));

  database.prepare("INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)")
    .run("user-1", "Ada");
  database.prepare(`
    INSERT INTO rooms (id, owner_user_id, name, join_code)
    VALUES (?, ?, ?, ?)
  `).run("room-1", "user-1", "Platform", "ROOM42");
  database.prepare(`
    INSERT INTO meetings (id, room_id, talk_limit_seconds, started_by_user_id)
    VALUES (?, ?, ?, ?)
  `).run("meeting-1", "room-1", 120, "user-1");
  database.prepare(`
    INSERT INTO speeches (
      id, meeting_id, speaker_user_id, started_by_user_id,
      talk_limit_seconds, resumed_at
    ) VALUES (?, ?, ?, ?, ?, unixepoch())
  `).run("speech-1", "meeting-1", "user-1", "user-1", 120);

  assert.throws(() => database.prepare(`
    INSERT INTO speeches (
      id, meeting_id, speaker_user_id, started_by_user_id,
      talk_limit_seconds, resumed_at
    ) VALUES (?, ?, ?, ?, ?, unixepoch())
  `).run("speech-2", "meeting-1", "user-1", "user-1", 120), /UNIQUE/);

  assert.throws(() => database.prepare(`
    UPDATE speeches SET status = 'paused' WHERE id = ?
  `).run("speech-1"), /CHECK/);

  const indexes = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'index' AND name LIKE 'speeches_%'
    ORDER BY name
  `).all().map(({ name }) => name);
  assert.deepEqual(indexes, ["speeches_history_by_meeting", "speeches_one_open_per_meeting"]);
});

test("the assignment migration separates current-call and preparation task rounds", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(migrationUrl, "utf8"));
  database.exec(await readFile(meetingMigrationUrl, "utf8"));
  database.exec(await readFile(assignmentMigrationUrl, "utf8"));

  database.prepare("INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)")
    .run("user-1", "Ada");
  database.prepare(`
    INSERT INTO rooms (id, owner_user_id, name, join_code)
    VALUES (?, ?, ?, ?)
  `).run("room-1", "user-1", "Platform", "ROOM42");
  database.prepare(`
    INSERT INTO meetings (id, room_id, talk_limit_seconds, started_by_user_id)
    VALUES (?, ?, ?, ?)
  `).run("meeting-1", "room-1", 120, "user-1");

  const insert = database.prepare(`
    INSERT INTO assignments (
      id, room_id, meeting_id, kind, cycle_number,
      participant_user_id, assigned_by_user_id, task_en, task_ru, model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    "assignment-1", "room-1", null, "next", 1,
    "user-1", "user-1", "Tell a joke", "Расскажите шутку", "test-model",
  );
  assert.throws(() => insert.run(
    "assignment-2", "room-1", null, "next", 1,
    "user-1", "user-1", "Another", "Другое", "test-model",
  ), /UNIQUE/);
  assert.throws(() => insert.run(
    "assignment-3", "room-1", null, "current", 1,
    "user-1", "user-1", "Another", "Другое", "test-model",
  ), /CHECK/);

  insert.run(
    "assignment-4", "room-1", "meeting-1", "current", 1,
    "user-1", "user-1", "Share a story", "Расскажите историю", "test-model",
  );
  const indexes = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'index' AND name LIKE 'assignments_%'
    ORDER BY name
  `).all().map(({ name }) => name);
  assert.deepEqual(indexes, [
    "assignments_by_participant",
    "assignments_current_cycle_participant",
    "assignments_history_by_room",
    "assignments_next_cycle_participant",
  ]);
});

test("the quiz migration models reusable validated question templates", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(migrationUrl, "utf8"));
  database.exec(await readFile(quizMigrationUrl, "utf8"));

  database.prepare("INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)")
    .run("user-1", "Ada");
  database.prepare(`
    INSERT INTO rooms (id, owner_user_id, name, join_code)
    VALUES (?, ?, ?, ?)
  `).run("room-1", "user-1", "Platform", "ROOM42");
  database.prepare(`
    INSERT INTO quizzes (
      id, room_id, title, created_by_user_id, updated_by_user_id
    ) VALUES (?, ?, ?, ?, ?)
  `).run("quiz-1", "room-1", "Engineering", "user-1", "user-1");
  database.prepare(`
    INSERT INTO quiz_questions (id, quiz_id, position, prompt, time_limit_seconds)
    VALUES (?, ?, ?, ?, ?)
  `).run("question-1", "quiz-1", 1, "What is D1?", 20);

  const insertOption = database.prepare(`
    INSERT INTO quiz_options (id, question_id, position, text, is_correct)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertOption.run("option-1", "question-1", 1, "A database", 1);
  insertOption.run("option-2", "question-1", 2, "A queue", 0);
  assert.throws(() => insertOption.run(
    "option-3", "question-1", 3, "Another database", 1,
  ), /UNIQUE/);
  assert.throws(() => database.prepare(`
    INSERT INTO quiz_questions (id, quiz_id, position, prompt, time_limit_seconds)
    VALUES (?, ?, ?, ?, ?)
  `).run("question-2", "quiz-1", 2, "Too fast", 2), /CHECK/);

  const tables = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name LIKE 'quiz%'
    ORDER BY name
  `).all().map(({ name }) => name);
  assert.deepEqual(tables, ["quiz_options", "quiz_questions", "quizzes"]);
});

test("the quiz game migration snapshots live games, participants and answers", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(migrationUrl, "utf8"));
  database.exec(await readFile(quizMigrationUrl, "utf8"));
  database.exec(await readFile(quizGameMigrationUrl, "utf8"));
  database.exec(await readFile(quizQuestionPhaseMigrationUrl, "utf8"));

  database.prepare("INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)")
    .run("user-1", "Ada");
  database.prepare(`
    INSERT INTO rooms (id, owner_user_id, name, join_code)
    VALUES (?, ?, ?, ?)
  `).run("room-1", "user-1", "Platform", "ROOM42");
  database.prepare(`
    INSERT INTO quizzes (id, room_id, title, created_by_user_id, updated_by_user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run("quiz-1", "room-1", "Engineering", "user-1", "user-1");
  database.prepare(`
    INSERT INTO quiz_questions (id, quiz_id, position, prompt, time_limit_seconds)
    VALUES (?, ?, 1, ?, 20)
  `).run("question-1", "quiz-1", "What is D1?");
  database.prepare(`
    INSERT INTO quiz_options (id, question_id, position, text, is_correct)
    VALUES (?, ?, 1, ?, 1), (?, ?, 2, ?, 0)
  `).run("option-1", "question-1", "Database", "option-2", "question-1", "Queue");

  database.prepare(`
    INSERT INTO quiz_games (id, room_id, quiz_id, title, host_user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run("game-1", "room-1", "quiz-1", "Engineering", "user-1");
  assert.throws(() => database.prepare(`
    INSERT INTO quiz_games (id, room_id, quiz_id, title, host_user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run("game-2", "room-1", "quiz-1", "Duplicate", "user-1"), /UNIQUE/);

  database.prepare(`
    INSERT INTO quiz_game_questions (
      id, game_id, source_question_id, position, prompt, time_limit_seconds
    ) VALUES (?, ?, ?, 1, ?, 20)
  `).run("game-question-1", "game-1", "question-1", "What is D1?");
  database.prepare(`
    INSERT INTO quiz_game_options (
      id, game_question_id, source_option_id, position, text, is_correct
    ) VALUES (?, ?, ?, 1, ?, 1), (?, ?, ?, 2, ?, 0)
  `).run(
    "game-option-1", "game-question-1", "option-1", "Database",
    "game-option-2", "game-question-1", "option-2", "Queue",
  );
  database.prepare(`
    INSERT INTO quiz_game_participants (game_id, user_id) VALUES (?, ?)
  `).run("game-1", "user-1");
  database.prepare(`
    UPDATE quiz_games
    SET status = 'active', current_question_position = 1,
      question_phase = 'question', question_started_at = unixepoch(), started_at = unixepoch()
    WHERE id = ?
  `).run("game-1");
  database.prepare(`
    INSERT INTO quiz_game_answers (
      id, game_id, game_question_id, participant_user_id,
      selected_option_id, is_correct, response_time_ms, points_awarded
    ) VALUES (?, ?, ?, ?, ?, 1, 1500, 950)
  `).run("answer-1", "game-1", "game-question-1", "user-1", "game-option-1");

  database.prepare("DELETE FROM quiz_questions WHERE id = ?").run("question-1");
  const snapshot = database.prepare(`
    SELECT prompt, source_question_id FROM quiz_game_questions WHERE id = ?
  `).get("game-question-1");
  assert.deepEqual({ ...snapshot }, { prompt: "What is D1?", source_question_id: null });
  assert.equal(
    database.prepare("SELECT points_awarded FROM quiz_game_answers WHERE id = ?")
      .get("answer-1").points_awarded,
    950,
  );
  assert.equal(
    database.prepare("SELECT question_phase FROM quiz_games WHERE id = ?")
      .get("game-1").question_phase,
    "question",
  );
});
