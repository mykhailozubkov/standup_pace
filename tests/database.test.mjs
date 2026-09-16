import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

const migrationUrl = new URL("../migrations/0001_create_rooms.sql", import.meta.url);
const authMigrationUrl = new URL("../migrations/0002_add_better_auth.sql", import.meta.url);
const rateLimitMigrationUrl = new URL("../migrations/0003_add_auth_rate_limit.sql", import.meta.url);

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
