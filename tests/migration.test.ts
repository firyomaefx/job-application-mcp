import { test, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

process.env.JOB_MCP_DATA_DIR = "./data-test-migration-v6";

import { closeDb, dbPath, openDb } from "../src/store/db.js";

test("schema v6 upgrades a legacy CV table without losing data", () => {
  closeDb();
  const path = dbPath();
  rmSync(dirname(path), { recursive: true, force: true });
  mkdirSync(dirname(path), { recursive: true });

  const legacy = new DatabaseSync(path);
  legacy.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta(key, value) VALUES ('schema_version', '5');
    CREATE TABLE profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, email TEXT,
      phone TEXT, location TEXT, headline TEXT, summary TEXT,
      skills TEXT NOT NULL DEFAULT '[]', experience_years INTEGER, label TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO profiles VALUES (1, 'Legacy User', NULL, NULL, NULL, NULL, NULL, '[]', NULL, 'default', '2026-01-01', '2026-01-01');
    CREATE TABLE cvs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      label TEXT NOT NULL, source_path TEXT, text TEXT NOT NULL, created_at TEXT NOT NULL
    );
    INSERT INTO cvs VALUES (7, 1, 'Legacy CV', NULL, 'verified legacy text', '2026-01-02');
  `);
  legacy.close();

  const migrated = openDb();
  const row = migrated.prepare("SELECT * FROM cvs WHERE id = 7").get() as Record<string, unknown>;
  assert.equal(row.text, "verified legacy text");
  assert.equal(row.parent_cv_id, null);
  assert.equal(row.is_active, 1);
  assert.equal(row.updated_at, "2026-01-02");
  const version = migrated.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string };
  assert.equal(version.value, "6");
  const integrity = migrated.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  assert.equal(integrity.integrity_check, "ok");
});

after(() => closeDb());
