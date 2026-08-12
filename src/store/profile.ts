import { openDb } from "./db.js";
import type { CandidateProfile } from "../lib/types.js";

type ProfileRow = Omit<CandidateProfile, "skills"> & { skills: string };

function now(): string {
  return new Date().toISOString();
}

function hydrate(row: ProfileRow): CandidateProfile {
  let skills: string[] = [];
  try {
    skills = JSON.parse(row.skills) as string[];
  } catch {
    skills = [];
  }
  const { skills: _ignored, ...rest } = row;
  return { ...rest, skills };
}

export function getProfile(id: number): CandidateProfile | null {
  const db = openDb();
  const row = db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(id) as ProfileRow | undefined;
  return row ? hydrate(row) : null;
}

/** Free core: the single default profile, auto-created on first access. */
export function getDefaultProfile(): CandidateProfile {
  const db = openDb();
  const row = db
    .prepare("SELECT * FROM profiles WHERE label = 'default' LIMIT 1")
    .get() as ProfileRow | undefined;
  if (row) return hydrate(row);

  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO profiles
        (full_name, email, phone, location, headline, summary, skills, experience_years, label, created_at, updated_at)
       VALUES (?, NULL, NULL, NULL, NULL, NULL, '[]', NULL, 'default', ?, ?)`
    )
    .run("Unnamed Candidate", ts, ts);
  return getProfile(Number(info.lastInsertRowid))!;
}

export function updateProfile(
  id: number,
  fields: Partial<Omit<CandidateProfile, "id" | "created_at" | "updated_at">>
): CandidateProfile {
  const db = openDb();
  const current = getProfile(id);
  if (!current) throw new Error(`Profile ${id} not found`);

  const next: CandidateProfile = {
    ...current,
    ...fields,
    skills: fields.skills ?? current.skills,
    updated_at: now(),
  };

  db.prepare(
    `UPDATE profiles SET
       full_name = ?, email = ?, phone = ?, location = ?,
       headline = ?, summary = ?, skills = ?, experience_years = ?,
       updated_at = ?
     WHERE id = ?`
  ).run(
    next.full_name,
    next.email,
    next.phone,
    next.location,
    next.headline,
    next.summary,
    JSON.stringify(next.skills),
    next.experience_years,
    next.updated_at,
    id
  );
  return next;
}

/**
 * List CVs for a profile. By default returns only the ACTIVE version of each
 * chain (is_active = 1) so the list reflects "current CVs". Pass
 * `includeInactive: true` to see every version (history).
 */
export function listCvs(profileId: number, opts: { includeInactive?: boolean } = {}) {
  const db = openDb();
  if (opts.includeInactive) {
    return db
      .prepare(
        "SELECT id, label, source_path, created_at, parent_cv_id, is_active, updated_at FROM cvs WHERE profile_id = ? ORDER BY id"
      )
      .all(profileId);
  }
  return db
    .prepare(
      "SELECT id, label, source_path, created_at, parent_cv_id, is_active, updated_at FROM cvs WHERE profile_id = ? AND is_active = 1 ORDER BY id"
    )
    .all(profileId);
}