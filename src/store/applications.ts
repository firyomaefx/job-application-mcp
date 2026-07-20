import { openDb } from "./db.js";
import type {
  Application,
  ApplicationStatus,
  Cv,
  Job,
  MatchResult,
} from "../lib/types.js";

function now(): string {
  return new Date().toISOString();
}

// ── CVs ────────────────────────────────────────────────────────

export function saveCv(profileId: number, label: string, text: string, sourcePath: string | null): Cv {
  const db = openDb();
  const info = db
    .prepare(
      "INSERT INTO cvs (profile_id, label, source_path, text, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(profileId, label, sourcePath, text, now());
  const row = db.prepare("SELECT * FROM cvs WHERE id = ?").get(Number(info.lastInsertRowid));
  return row as unknown as Cv;
}

export function getCv(id: number): Cv | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM cvs WHERE id = ?").get(id);
  return (row as Cv | undefined) ?? null;
}

/**
 * Revise a CV as a new version. Insert a new row whose `parent_cv_id` points at
 * the given CV (so you can branch from any historical version), make it the
 * sole ACTIVE version of its chain, and return it. The original text of every
 * prior version is preserved in its own row — nothing is deleted. The chain is
 * reconstructed by following `parent_cv_id`.
 *
 * Only `label` (no `text`) copies the referenced version's text, so a rename
 * also produces a traceable version.
 */
export function updateCv(
  profileId: number,
  id: number,
  fields: { label?: string; text?: string }
): Cv | null {
  const db = openDb();
  const prev = getCv(id);
  if (!prev || prev.profile_id !== profileId) return null;
  const ts = now();
  const label = fields.label ?? prev.label;
  const text = fields.text ?? prev.text;
  const info = db
    .prepare(
      `INSERT INTO cvs (profile_id, label, source_path, text, created_at, parent_cv_id, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .run(profileId, label, prev.source_path, text, ts, id, ts);
  // Deactivate every OTHER row in this chain so exactly one version is active.
  const chain = getCvHistory(profileId, id);
  const otherIds = chain.map((c) => c.id).filter((cid) => cid !== Number(info.lastInsertRowid));
  if (otherIds.length) {
    const placeholders = otherIds.map(() => "?").join(",");
    db.prepare(`UPDATE cvs SET is_active = 0 WHERE id IN (${placeholders})`).run(...otherIds);
  }
  return getCv(Number(info.lastInsertRowid));
}

/**
 * Return the full version chain for a CV: walk `parent_cv_id` up to the root,
 * then return all descendants of that root ordered oldest→newest. Any cv in the
 * chain resolves to the same set.
 */
export function getCvHistory(profileId: number, cvId: number): Cv[] {
  const db = openDb();
  // Walk to the root.
  let rootId = cvId;
  let cur = getCv(cvId);
  while (cur && cur.parent_cv_id != null) {
    rootId = cur.parent_cv_id;
    cur = getCv(rootId);
  }
  // Collect the root and all descendants linked by parent_cv_id (transitively).
  const rows: Cv[] = [];
  const queue = [rootId];
  const seen = new Set<number>();
  while (queue.length) {
    const head = queue.shift()!;
    if (seen.has(head)) continue;
    seen.add(head);
    const row = getCv(head);
    if (!row || row.profile_id !== profileId) continue;
    rows.push(row);
    const children = db
      .prepare("SELECT id FROM cvs WHERE parent_cv_id = ? AND profile_id = ? ORDER BY id")
      .all(head, profileId) as { id: number }[];
    for (const c of children) queue.push(c.id);
  }
  rows.sort((a, b) => a.id - b.id);
  return rows;
}

// ── Jobs ───────────────────────────────────────────────────────

export function saveJob(
  profileId: number,
  input: { title: string; company: string | null; url: string | null; description: string; keywords: string[] }
): Job {
  const db = openDb();
  const info = db
    .prepare(
      `INSERT INTO jobs (profile_id, title, company, url, description, keywords, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      profileId,
      input.title,
      input.company,
      input.url,
      input.description,
      JSON.stringify(input.keywords),
      now()
    );
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(Number(info.lastInsertRowid)) as
    | Omit<Job, "keywords">
    | { keywords: string };
  return { ...(row as object), keywords: input.keywords } as Job;
}

export function getJob(id: number): Job | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | (Omit<Job, "keywords"> & { keywords: string })
    | undefined;
  if (!row) return null;
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(row.keywords) as string[];
  } catch {
    keywords = [];
  }
  const { keywords: _k, ...rest } = row;
  return { ...rest, keywords };
}

// ── Job inbox (Phase 3) ────────────────────────────────────────

export function listInboxJobs(
  profileId: number,
  status?: "new" | "triaged" | "applied" | "archived"
): Job[] {
  const db = openDb();
  const rows = status
    ? db
        .prepare("SELECT * FROM jobs WHERE profile_id = ? AND inbox_status = ? ORDER BY id DESC")
        .all(profileId, status)
    : db.prepare("SELECT * FROM jobs WHERE profile_id = ? ORDER BY id DESC").all(profileId);
  return (rows as (Omit<Job, "keywords"> & { keywords: string })[]).map((row) => {
    let keywords: string[] = [];
    try {
      keywords = JSON.parse(row.keywords) as string[];
    } catch {
      keywords = [];
    }
    const { keywords: _k, ...rest } = row;
    return { ...rest, keywords };
  });
}

export function triageJob(
  profileId: number,
  jobId: number,
  status: "new" | "triaged" | "applied" | "archived"
): Job | null {
  const db = openDb();
  const existing = getJob(jobId);
  if (!existing || existing.profile_id !== profileId) return null;
  db.prepare("UPDATE jobs SET inbox_status = ? WHERE id = ?").run(status, jobId);
  return getJob(jobId);
}

// ── Applications ───────────────────────────────────────────────

export function saveApplication(
  input: {
    profile_id: number;
    job_id: number;
    cv_id?: number | null;
    match_score?: number | null;
    tailored_cv_text?: string | null;
    cover_letter?: string | null;
    answers?: Record<string, string>;
    status?: ApplicationStatus;
    notes?: string | null;
  }
): Application {
  const db = openDb();
  const ts = now();
  const status: ApplicationStatus = input.status ?? "draft";
  const info = db
    .prepare(
      `INSERT INTO applications
        (profile_id, job_id, cv_id, status, match_score, tailored_cv_text,
         cover_letter, answers, notes, submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(
      input.profile_id,
      input.job_id,
      input.cv_id ?? null,
      status,
      input.match_score ?? null,
      input.tailored_cv_text ?? null,
      input.cover_letter ?? null,
      JSON.stringify(input.answers ?? {}),
      input.notes ?? null,
      ts,
      ts
    );
  return getApplication(Number(info.lastInsertRowid))!;
}

export function getApplication(id: number): Application | null {
  const db = openDb();
  const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as
    | (Omit<Application, "answers"> & { answers: string })
    | undefined;
  if (!row) return null;
  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(row.answers) as Record<string, string>;
  } catch {
    answers = {};
  }
  const { answers: _a, ...rest } = row;
  return { ...rest, answers };
}

export function listApplications(profileId: number): Application[] {
  const db = openDb();
  const rows = db
    .prepare("SELECT * FROM applications WHERE profile_id = ? ORDER BY id DESC")
    .all(profileId) as (Omit<Application, "answers"> & { answers: string })[];
  return rows.map((row) => {
    let answers: Record<string, string> = {};
    try {
      answers = JSON.parse(row.answers) as Record<string, string>;
    } catch {
      answers = {};
    }
    const { answers: _a, ...rest } = row;
    return { ...rest, answers };
  });
}

export function updateApplicationStatus(
  id: number,
  status: ApplicationStatus,
  notes?: string
): Application | null {
  const db = openDb();
  const ts = now();
  const submittedAt =
    status === "submitted" ? ts : undefined;
  if (submittedAt) {
    db.prepare(
      "UPDATE applications SET status = ?, notes = COALESCE(?, notes), submitted_at = ?, updated_at = ? WHERE id = ?"
    ).run(status, notes ?? null, submittedAt, ts, id);
  } else {
    db.prepare(
      "UPDATE applications SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?"
    ).run(status, notes ?? null, ts, id);
  }
  return getApplication(id);
}

/**
 * Partially update an application's editable fields: tailored CV text, cover
 * letter, screening answers, notes, cv_id, match_score. Status is unchanged
 * (use updateApplicationStatus for that). Only provided fields are written; the
 * rest are preserved. Returns the updated row or null if not found.
 */
export function updateApplication(
  id: number,
  fields: {
    cv_id?: number | null;
    match_score?: number | null;
    tailored_cv_text?: string | null;
    cover_letter?: string | null;
    answers?: Record<string, string>;
    notes?: string | null;
  }
): Application | null {
  const existing = getApplication(id);
  if (!existing) return null;
  const db = openDb();
  const ts = now();
  db.prepare(
    `UPDATE applications SET
       cv_id = ?, match_score = ?, tailored_cv_text = ?, cover_letter = ?,
       answers = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    fields.cv_id !== undefined ? fields.cv_id : existing.cv_id,
    fields.match_score !== undefined ? fields.match_score : existing.match_score,
    fields.tailored_cv_text !== undefined ? fields.tailored_cv_text : existing.tailored_cv_text,
    fields.cover_letter !== undefined ? fields.cover_letter : existing.cover_letter,
    JSON.stringify(fields.answers ?? existing.answers),
    fields.notes !== undefined ? fields.notes : existing.notes,
    ts,
    id
  );
  return getApplication(id);
}

// Re-export MatchResult type for tool modules that compose it.
export type { MatchResult };