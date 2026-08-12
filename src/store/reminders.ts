import { openDb } from "./db.js";
import type { Reminder } from "../lib/types.js";

function now(): string {
  return new Date().toISOString();
}

export function addReminder(
  input: {
    profile_id: number;
    application_id?: number | null;
    job_id?: number | null;
    kind: Reminder["kind"];
    title: string;
    due_at: string; // ISO date (date or datetime)
  }
): Reminder {
  const db = openDb();
  const info = db
    .prepare(
      `INSERT INTO reminders
         (profile_id, application_id, job_id, kind, title, due_at, done, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      input.profile_id,
      input.application_id ?? null,
      input.job_id ?? null,
      input.kind,
      input.title,
      input.due_at,
      now()
    );
  return getReminder(Number(info.lastInsertRowid))!;
}

export function getReminder(id: number): Reminder | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
  return (row as unknown as Reminder | undefined) ?? null;
}

/**
 * List reminders for a profile. Default: open (not done). Pass includeDone to
 * see completed ones too. Sorted by due_at ascending.
 */
export function listReminders(profileId: number, opts: { includeDone?: boolean } = {}): Reminder[] {
  const db = openDb();
  const rows = opts.includeDone
    ? db
        .prepare("SELECT * FROM reminders WHERE profile_id = ? ORDER BY due_at ASC")
        .all(profileId)
    : db
        .prepare("SELECT * FROM reminders WHERE profile_id = ? AND done = 0 ORDER BY due_at ASC")
        .all(profileId);
  return rows as unknown as Reminder[];
}

/** Open reminders whose due_at is on or before `nowIso` (i.e. due/overdue). */
export function dueReminders(profileId: number, nowIso: string): Reminder[] {
  const db = openDb();
  const rows = db
    .prepare(
      "SELECT * FROM reminders WHERE profile_id = ? AND done = 0 AND due_at <= ? ORDER BY due_at ASC"
    )
    .all(profileId, nowIso);
  return rows as unknown as Reminder[];
}

export function completeReminder(id: number): Reminder | null {
  const db = openDb();
  db.prepare("UPDATE reminders SET done = 1 WHERE id = ?").run(id);
  return getReminder(id);
}

export function deleteReminder(id: number): boolean {
  const db = openDb();
  const info = db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
  return Number(info.changes) > 0;
}