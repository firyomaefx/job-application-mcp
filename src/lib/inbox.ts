// Pure inbox ranking helper — no I/O, fully unit-testable.
//
// A job's rank blends the best known match score (from an application, if any)
// with a small recency bonus so a fresh, decently-matched job surfaces above an
// older, slightly-higher one. Returned values are 0..100-ish for display.

import type { Job, Application } from "../lib/types.js";

export interface RankableJob {
  job: Pick<Job, "id" | "title" | "company" | "inbox_status" | "created_at">;
  match_score: number | null;
}

/**
 * Score a single job: match score (0..100) + a recency bonus that decays over
 * 30 days. Jobs with no match score still get the recency bonus so new imports
 * appear at the top of the inbox until triaged.
 */
export function rankScore(input: RankableJob, nowMs: number): number {
  const score = input.match_score ?? 0;
  const created = Date.parse(input.job.created_at);
  const ageDays = Number.isFinite(created) ? Math.max(0, (nowMs - created) / 86_400_000) : 0;
  const recencyBonus = Math.max(0, 20 - (ageDays / 30) * 20); // 20 → 0 over 30 days
  return Math.round((score + recencyBonus) * 10) / 10;
}

/**
 * Rank jobs for the inbox. Jobs with `inbox_status === 'archived'` are excluded
 * by default (pass includeArchived to include). Returns the list sorted by
 * rank descending, with the computed rank attached.
 */
export function rankJobs(
  jobs: RankableJob[],
  nowMs: number,
  opts: { includeArchived?: boolean } = {}
): { job: RankableJob["job"]; rank: number; match_score: number | null }[] {
  const filtered = jobs.filter((j) => (opts.includeArchived ? true : j.job.inbox_status !== "archived"));
  return filtered
    .map((j) => ({ job: j.job, match_score: j.match_score, rank: rankScore(j, nowMs) }))
    .sort((a, b) => b.rank - a.rank);
}

/**
 * Attach the best (highest) application match_score to each job. Used by the
 * inbox tool to populate RankableJob.match_score from stored applications.
 */
export function bestMatchScore(jobId: number, apps: Pick<Application, "job_id" | "match_score">[]): number | null {
  const scores = apps.filter((a) => a.job_id === jobId && a.match_score != null).map((a) => a.match_score as number);
  return scores.length ? Math.max(...scores) : null;
}