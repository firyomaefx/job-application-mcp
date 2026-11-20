import { openDb } from "./db.js";
import type { Application } from "../lib/types.js";

export type ApplyQueueStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "applying"
  | "paused"
  | "done"
  | "failed"
  | "cancelled";

export interface ApplyQueueItem {
  id: number;
  profile_id: number;
  job_id: number | null;
  url: string;
  status: ApplyQueueStatus;
  application_id: number | null;
  error: string | null;
  pause_reason: string | null;
  adapter_id: string | null;
  created_at: string;
  updated_at: string;
}

function now(): string {
  return new Date().toISOString();
}

function hydrate(row: ApplyQueueItem): ApplyQueueItem {
  return row;
}

export function enqueueApply(profileId: number, url: string, jobId?: number | null): ApplyQueueItem {
  const db = openDb();
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO apply_queue (profile_id, job_id, url, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    )
    .run(profileId, jobId ?? null, url, ts, ts);
  const id = Number(info.lastInsertRowid);
  return getQueueItem(id)!;
}

export function getQueueItem(id: number): ApplyQueueItem | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM apply_queue WHERE id = ?").get(id) as ApplyQueueItem | undefined;
  return row ? hydrate(row) : null;
}

export function listApplyQueue(profileId: number, status?: ApplyQueueStatus): ApplyQueueItem[] {
  const db = openDb();
  if (status) {
    return db
      .prepare("SELECT * FROM apply_queue WHERE profile_id = ? AND status = ? ORDER BY id DESC")
      .all(profileId, status) as unknown as ApplyQueueItem[];
  }
  return db
    .prepare("SELECT * FROM apply_queue WHERE profile_id = ? ORDER BY id DESC")
    .all(profileId) as unknown as ApplyQueueItem[];
}

export function updateQueueItem(
  id: number,
  patch: Partial<
    Pick<
      ApplyQueueItem,
      "status" | "application_id" | "error" | "pause_reason" | "adapter_id" | "job_id"
    >
  >,
): ApplyQueueItem | null {
  const current = getQueueItem(id);
  if (!current) return null;
  const db = openDb();
  const next = {
    status: patch.status ?? current.status,
    application_id: patch.application_id !== undefined ? patch.application_id : current.application_id,
    error: patch.error !== undefined ? patch.error : current.error,
    pause_reason: patch.pause_reason !== undefined ? patch.pause_reason : current.pause_reason,
    adapter_id: patch.adapter_id !== undefined ? patch.adapter_id : current.adapter_id,
    job_id: patch.job_id !== undefined ? patch.job_id : current.job_id,
    updated_at: now(),
  };
  db.prepare(
    `UPDATE apply_queue SET status = ?, application_id = ?, error = ?, pause_reason = ?, adapter_id = ?, job_id = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    next.status,
    next.application_id,
    next.error,
    next.pause_reason,
    next.adapter_id,
    next.job_id,
    next.updated_at,
    id,
  );
  return getQueueItem(id);
}

export function cancelQueueItem(id: number): ApplyQueueItem | null {
  const item = getQueueItem(id);
  if (!item) return null;
  if (item.status === "done" || item.status === "cancelled") return item;
  return updateQueueItem(id, { status: "cancelled", error: null, pause_reason: null });
}

/** Submissions recorded today (UTC day) for daily apply cap. */
export function countSubmissionsToday(profileId: number, now = new Date()): number {
  const db = openDb();
  const day = now.toISOString().slice(0, 10);
  const from = `${day}T00:00:00.000Z`;
  const to = `${day}T23:59:59.999Z`;
  const apps = db
    .prepare(
      `SELECT COUNT(*) AS c FROM applications
       WHERE profile_id = ? AND status = 'submitted' AND submitted_at >= ? AND submitted_at <= ?`,
    )
    .get(profileId, from, to) as { c: number };
  const queued = db
    .prepare(
      `SELECT COUNT(*) AS c FROM apply_queue
       WHERE profile_id = ? AND status = 'done' AND updated_at >= ? AND updated_at <= ?`,
    )
    .get(profileId, from, to) as { c: number };
  return Math.max(apps.c, queued.c);
}

export function assertApplicationReady(app: Application): void {
  if (app.cv_id == null) throw new Error("application needs cv_id before auto-apply");
  if (app.status === "submitted") throw new Error("application already submitted");
}