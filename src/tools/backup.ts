// Backup / restore tools (N6). Local-only snapshots of the user's SQLite DB.

import { z } from "zod";
import type { ToolDef } from "./types.js";
import { backupDatabase, listBackups, restoreDatabase } from "../store/backup.js";

const backupSchema = z.object({});

export const backupDataTool: ToolDef<typeof backupSchema> = {
  name: "backup_data",
  description:
    "Snapshot the local SQLite database to a timestamped file under <dataDir>/backups. " +
    "Purely local; no upload. Returns the backup path. Use list_backups and restore_data to recover.",
  inputSchema: backupSchema,
  run: () => {
    const path = backupDatabase();
    return {
      summary: `Backup written to ${path}.`,
      data: { path },
      notes: ["Local only. Backups live under <JOB_MCP_DATA_DIR>/backups/."],
    };
  },
};

const listBackupsSchema = z.object({});

export const listBackupsTool: ToolDef<typeof listBackupsSchema> = {
  name: "list_backups",
  description: "List local database backup snapshots (newest first).",
  inputSchema: listBackupsSchema,
  run: () => {
    const backups = listBackups();
    return {
      summary: `${backups.length} backup(s) available.`,
      data: backups.map((b) => ({ name: b.name, path: b.path, size: b.size, created_at: b.created_at })),
    };
  },
};

const restoreSchema = z.object({
  target: z.string().min(1).describe("Backup file name (e.g. job-mcp-2026-07-20T0120.db) or absolute path."),
});

export const restoreDataTool: ToolDef<typeof restoreSchema> = {
  name: "restore_data",
  description:
    "Restore the local database from a backup snapshot. A safety snapshot of the current DB is taken first, " +
    "so a bad restore can be rolled back by restoring that safety backup. Local only; no download.",
  inputSchema: restoreSchema,
  run: (input) => {
    const result = restoreDatabase(input.target);
    return {
      summary: `Restored from ${result.restored_from}.`,
      data: result,
      notes: [
        `A pre-restore safety backup was written to ${result.safety_backup}.`,
        "Restore it if this recovery was wrong.",
      ],
    };
  },
};