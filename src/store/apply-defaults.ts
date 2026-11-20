import { openDb } from "./db.js";
import {
  DEFAULT_MAX_APPLIES_PER_DAY,
  DEFAULT_MIN_MATCH_SCORE,
} from "../apply/config.js";

export interface ApplyDefaults {
  profile_id: number;
  answers: Record<string, string>;
  min_match_score: number;
  max_applies_per_day: number;
  auto_enqueue_on_detect: boolean;
  updated_at: string;
}

const DEFAULT_ANSWER_KEYS = [
  "work_authorization",
  "salary_expectation",
  "notice_period",
  "relocation",
  "linkedin_url",
] as const;

function now(): string {
  return new Date().toISOString();
}

export function getApplyDefaults(profileId: number): ApplyDefaults {
  const db = openDb();
  const row = db
    .prepare(
      `SELECT profile_id, answers, min_match_score, max_applies_per_day, auto_enqueue_on_detect, updated_at
       FROM apply_defaults WHERE profile_id = ?`,
    )
    .get(profileId) as
    | {
        profile_id: number;
        answers: string;
        min_match_score: number;
        max_applies_per_day: number;
        auto_enqueue_on_detect: number;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    return {
      profile_id: profileId,
      answers: {},
      min_match_score: DEFAULT_MIN_MATCH_SCORE,
      max_applies_per_day: DEFAULT_MAX_APPLIES_PER_DAY,
      auto_enqueue_on_detect: false,
      updated_at: now(),
    };
  }

  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(row.answers) as Record<string, string>;
  } catch {
    answers = {};
  }

  return {
    profile_id: row.profile_id,
    answers,
    min_match_score: row.min_match_score,
    max_applies_per_day: row.max_applies_per_day,
    auto_enqueue_on_detect: row.auto_enqueue_on_detect === 1,
    updated_at: row.updated_at,
  };
}

export function setApplyDefaults(
  profileId: number,
  patch: Partial<
    Pick<ApplyDefaults, "answers" | "min_match_score" | "max_applies_per_day" | "auto_enqueue_on_detect">
  >,
): ApplyDefaults {
  const current = getApplyDefaults(profileId);
  const next: ApplyDefaults = {
    ...current,
    answers: patch.answers ? { ...current.answers, ...patch.answers } : current.answers,
    min_match_score: patch.min_match_score ?? current.min_match_score,
    max_applies_per_day: patch.max_applies_per_day ?? current.max_applies_per_day,
    auto_enqueue_on_detect: patch.auto_enqueue_on_detect ?? current.auto_enqueue_on_detect,
    updated_at: now(),
  };

  const db = openDb();
  db.prepare(
    `INSERT INTO apply_defaults (profile_id, answers, min_match_score, max_applies_per_day, auto_enqueue_on_detect, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET
       answers = excluded.answers,
       min_match_score = excluded.min_match_score,
       max_applies_per_day = excluded.max_applies_per_day,
       auto_enqueue_on_detect = excluded.auto_enqueue_on_detect,
       updated_at = excluded.updated_at`,
  ).run(
    profileId,
    JSON.stringify(next.answers),
    next.min_match_score,
    next.max_applies_per_day,
    next.auto_enqueue_on_detect ? 1 : 0,
    next.updated_at,
  );

  return next;
}

export { DEFAULT_ANSWER_KEYS };