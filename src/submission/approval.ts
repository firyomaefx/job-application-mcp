// Approval-gated submission recording (N5).
//
// The MCP tools never submit a form to an employer site — submission is a
// manual, user-performed action. This module gates the *recording* of a
// submission so that "submission never occurs without approval" is enforced
// at the data layer too, with:
//   - a valid application id
//   - a recent successful validation (request_approval ran the checks)
//   - an approved document (cv_id set)
//   - no unresolved sensitive form fields (when a form preview is supplied)
//   - a duplicate-application check (one submission per job)
//   - explicit user approval via a short-lived, single-use token
//
// Tokens are random, persisted, expire after APPROVAL_TTL_MS, and are marked
// used on confirm — they cannot be replayed.

import { randomBytes } from "node:crypto";
import { openDb } from "../store/db.js";
import { getDefaultProfile } from "../store/profile.js";
import {
  getApplication,
  getJob,
  listApplications,
  updateApplicationStatus,
} from "../store/applications.js";
import { safeEqual } from "../lib/crypto.js";

/** Approval token lifetime: 10 minutes. */
export const APPROVAL_TTL_MS = 10 * 60_000;

/** A sensitive form field that still needs user review blocks approval. */
export interface FormFieldPreview {
  name: string;
  label?: string;
  mapped_to?: string;
  value?: string;
  requires_user_review?: boolean;
}

export interface ApprovalRequest {
  application_id: number;
  approval_token: string;
  expires_at: string;
  checks: string[];
}

export interface ApprovalValidationError {
  ok: false;
  error: string;
  checks?: string[];
}

function nowIso(d = new Date()): string {
  return d.toISOString();
}

function isSensitiveField(f: FormFieldPreview): boolean {
  const s = `${f.name} ${f.label ?? f.mapped_to ?? ""}`.toLowerCase();
  return (
    s.includes("salary") ||
    s.includes("authorized") ||
    s.includes("visa") ||
    s.includes("gender") ||
    s.includes("race") ||
    s.includes("disability") ||
    s.includes("consent") ||
    s.includes("agree")
  );
}

/**
 * Run the pre-submission validation gate WITHOUT issuing a token. Returns the
 * list of passed checks, or throws with the first blocking failure. Exposed for
 * tests and for `request_approval` to reuse.
 */
export function validateForSubmission(applicationId: number, formFields?: FormFieldPreview[]): string[] {
  const app = getApplication(applicationId);
  if (!app) throw new Error("application not found");
  if (app.status === "submitted") throw new Error("application already submitted");
  if (app.cv_id == null) throw new Error("no approved CV attached (cv_id required)");

  const job = getJob(app.job_id);
  if (!job) throw new Error("linked job not found");

  // Duplicate-application check: no other submitted app for the same job.
  const profile = getDefaultProfile();
  const dup = listApplications(profile.id).find(
    (a) => a.job_id === app.job_id && a.id !== app.id && a.status === "submitted",
  );
  if (dup) throw new Error(`already submitted for this job (application ${dup.id})`);

  const checks = [
    "valid application id",
    `job linked: ${job.title}`,
    "approved CV attached",
    "not already submitted",
    "no duplicate submission for this job",
  ];

  if (formFields && formFields.length) {
    const unresolved = formFields.filter(
      (f) => isSensitiveField(f) && (f.requires_user_review || !f.value),
    );
    if (unresolved.length) {
      throw new Error(
        `unresolved sensitive field(s): ${unresolved.map((f) => f.name).join(", ")}`,
      );
    }
    checks.push("no unresolved sensitive fields");
  }

  return checks;
}

/** Issue a short-lived, single-use approval token after running the gate. */
export function requestApproval(applicationId: number, formFields?: FormFieldPreview[]): ApprovalRequest {
  const checks = validateForSubmission(applicationId, formFields);
  const profile = getDefaultProfile();
  const db = openDb();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString();
  const token = randomBytes(24).toString("hex");
  db.prepare(
    `INSERT INTO approval_tokens (profile_id, application_id, token, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(profile.id, applicationId, token, createdAt, expiresAt);
  return { application_id: applicationId, approval_token: token, expires_at: expiresAt, checks };
}

/**
 * Consume a single-use approval token and record the submission. The tool does
 * NOT submit to a browser — it records a user-performed submission after
 * verifying the gate. Returns the updated application or throws.
 */
export function confirmSubmission(
  applicationId: number,
  approvalToken: string,
  confirmation?: string,
  now = new Date(),
) {
  const db = openDb();
  const rows = db
    .prepare(
      "SELECT id, token, expires_at, used_at FROM approval_tokens WHERE application_id = ? ORDER BY id DESC",
    )
    .all(applicationId) as { id: number; token: string; expires_at: string; used_at: string | null }[];

  if (!rows.length) throw new Error("no approval token for this application");

  // Find the unused, matching, unexpired token (constant-time compare).
  let matched: { id: number; expires_at: string } | null = null;
  for (const r of rows) {
    if (r.used_at) continue;
    if (!safeEqual(r.token, approvalToken)) continue;
    matched = r;
    break;
  }
  if (!matched) throw new Error("invalid or already-used approval token");
  if (new Date(matched.expires_at).getTime() <= now.getTime()) {
    throw new Error("approval token expired");
  }

  // Re-run the gate at confirm time (defence-in-depth: state may have changed).
  validateForSubmission(applicationId);

  db.prepare("UPDATE approval_tokens SET used_at = ? WHERE id = ?").run(nowIso(now), matched.id);
  const app = updateApplicationStatus(applicationId, "submitted", confirmation ?? "submitted via approved token");
  if (!app) throw new Error("application vanished during confirm");
  return app;
}