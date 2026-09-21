import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

class TestD1PreparedStatement {
  constructor(database, sql, parameters = []) {
    this.database = database;
    this.sql = sql;
    this.parameters = parameters;
  }

  bind(...parameters) {
    return new TestD1PreparedStatement(this.database, this.sql, parameters);
  }

  async all() {
    const rows = this.database.prepare(this.sql).all(...this.parameters);
    const meta = this.database.prepare(`
      SELECT changes() AS changes, last_insert_rowid() AS last_row_id
    `).get();
    return {
      results: rows.map((row) => ({ ...row })),
      meta: {
        changes: Number(meta.changes),
        last_row_id: Number(meta.last_row_id),
      },
    };
  }
}

class TestD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new TestD1PreparedStatement(this.database, sql);
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.all()));
  }

  async exec(sql) {
    this.database.exec(sql);
    return { count: 1, duration: 0 };
  }

  query(sql, ...parameters) {
    return this.database.prepare(sql).all(...parameters).map((row) => ({ ...row }));
  }
}

export async function createTestD1() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const filename of [
    "0001_create_rooms.sql",
    "0002_add_better_auth.sql",
    "0003_add_auth_rate_limit.sql",
    "0004_create_meetings.sql",
    "0005_create_speeches.sql",
    "0006_create_assignments.sql",
    "0007_create_quizzes.sql",
    "0008_create_quiz_games.sql",
    "0009_add_quiz_question_phases.sql",
  ]) {
    const migrationUrl = new URL(`../../migrations/${filename}`, import.meta.url);
    database.exec(await readFile(migrationUrl, "utf8"));
  }
  return new TestD1Database(database);
}
