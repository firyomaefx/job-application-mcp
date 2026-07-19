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

// Re-export MatchResult type for tool modules that compose it.
export type { MatchResult };