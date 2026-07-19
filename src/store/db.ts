import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const DEFAULT_DATA_DIR = resolve(process.cwd(), "data");

export function dataDir(): string {
  return process.env.JOB_MCP_DATA_DIR
    ? resolve(process.env.JOB_MCP_DATA_DIR)
    : DEFAULT_DATA_DIR;
}

export function dbPath(): string {
  return join(dataDir(), "job-mcp.db");
}

let cached: DatabaseSync | null = null;

/** Open (or create) the local SQLite database and run migrations. */
export function openDb(): DatabaseSync {
  if (cached) return cached;

  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(dbPath());
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  migrate(db);
  cached = db;
  return db;
}

function migrate(db: DatabaseSync): void {
  // Schema version is tracked in the `meta` table.
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name        TEXT NOT NULL,
      email            TEXT,
      phone            TEXT,
      location         TEXT,
      headline         TEXT,
      summary          TEXT,
      skills           TEXT NOT NULL DEFAULT '[]',
      experience_years INTEGER,
      label            TEXT NOT NULL DEFAULT 'default',
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cvs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      label       TEXT NOT NULL,
      source_path TEXT,
      text        TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      company     TEXT,
      url         TEXT,
      description TEXT NOT NULL,
      keywords    TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id       INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      job_id           INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      cv_id            INTEGER REFERENCES cvs(id) ON DELETE SET NULL,
      status           TEXT NOT NULL DEFAULT 'draft',
      match_score      INTEGER,
      tailored_cv_text TEXT,
      cover_letter     TEXT,
      answers          TEXT NOT NULL DEFAULT '{}',
      submitted_at     TEXT,
      notes            TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_applications_profile ON applications(profile_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_profile ON jobs(profile_id);
    CREATE INDEX IF NOT EXISTS idx_cvs_profile ON cvs(profile_id);
  `);

  // ── schema v2: credits + business (Stage 2/4 seams) ─────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_balance (
      profile_id      INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      balance         INTEGER NOT NULL DEFAULT 0,
      period          TEXT NOT NULL,            -- e.g. "2026-07" (month)
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id      INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      delta           INTEGER NOT NULL,         -- +credit / -debit
      reason          TEXT NOT NULL,            -- 'grant' | 'topup' | 'ai_tailor' | 'ai_cover' | 'ai_answer'
      ref             TEXT,                     -- application_id or topup code
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_profile ON credit_ledger(profile_id);

    CREATE TABLE IF NOT EXISTS accounts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      plan            TEXT NOT NULL DEFAULT 'business',
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      profile_id      INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role            TEXT NOT NULL DEFAULT 'candidate',  -- 'owner' | 'coach' | 'candidate'
      added_at        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_members_account ON team_members(account_id);
  `);

  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get("schema_version") as
    | { value: string }
    | undefined;
  const current = row ? Number(row.value) : 0;
  if (current < 2) {
    db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES (?, '2')").run("schema_version");
  }
}

/** Close the cached connection. Mainly for tests. */
export function closeDb(): void {
  if (cached) {
    cached.close();
    cached = null;
  }
}

/** Reset everything. Tests only. */
export function resetDb(): void {
  const db = openDb();
  db.exec(`
    DELETE FROM team_members;
    DELETE FROM accounts;
    DELETE FROM credit_ledger;
    DELETE FROM credit_balance;
    DELETE FROM applications;
    DELETE FROM jobs;
    DELETE FROM cvs;
    DELETE FROM profiles;
  `);
}