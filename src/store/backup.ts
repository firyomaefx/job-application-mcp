// Local backup / restore (N6). Free-core feature: the user's SQLite DB can be
// snapshotted to a timestamped file under <dataDir>/backups and restored with a
// pre-restore safety snapshot (rollback). No network — purely local.
//
// MVP release gate "Backup restoration works" is satisfied here + by tests.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { openDb, closeDb, dbPath, dataDir } from "./db.js";

const BACKUP_DIR = "backups";
const DB_SUFFIX = ".db";

function backupsDir(): string {
  const dir = join(dataDir(), BACKUP_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function timestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  created_at: string;
}

/**
 * Snapshot the DB to <dataDir>/backups/job-mcp-<timestamp>.db. Checkpoints WAL
 * first so the snapshot is complete. Returns the backup path.
 */
export function backupDatabase(now = new Date()): string {
  const db = openDb();
  // Flush WAL into the main DB so the copy is self-contained.
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const dest = join(backupsDir(), `job-mcp-${timestamp(now)}${DB_SUFFIX}`);
  copyFileSync(dbPath(), dest);
  return dest;
}

/** List available backups (newest first by mtime). */
export function listBackups(): BackupInfo[] {
  const dir = backupsDir();
  return readdirSync(dir)
    .filter((f) => f.endsWith(DB_SUFFIX) && f.startsWith("job-mcp-"))
    .map((f) => {
      const p = join(dir, f);
      const st = statSync(p);
      return { name: f, path: p, size: st.size, created_at: st.mtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Restore from a backup file. A pre-restore safety snapshot is taken first so a
 * bad restore can itself be rolled back. The cached DB connection is closed and
 * reopened against the restored file. Accepts an absolute path or a backup name
 * in the backups dir.
 */
export function restoreDatabase(target: string, now = new Date()): { restored_from: string; safety_backup: string } {
  const src = existsSync(target)
    ? target
    : join(backupsDir(), target.endsWith(DB_SUFFIX) ? target : `${target}${DB_SUFFIX}`);
  if (!existsSync(src)) throw new Error(`backup not found: ${target}`);

  // Safety snapshot of the current DB before overwriting (rollback safety).
  const safety = backupDatabase(now);

  // Close the open connection so the file is writable, then swap files.
  closeDb();
  const main = dbPath();
  // Remove WAL/SHM sidecars so the restored DB starts clean.
  for (const ext of ["-wal", "-shm"]) {
    const side = main + ext;
    if (existsSync(side)) rmSync(side, { force: true });
  }
  copyFileSync(src, main);

  // Reopen so the cache reflects the restored data.
  openDb();
  return { restored_from: src, safety_backup: safety };
}