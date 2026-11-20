import { getDefaultProfile } from "../store/profile.js";
import { getApplication, listApplications } from "../store/applications.js";
import { getApplyDefaults } from "../store/apply-defaults.js";
import { countSubmissionsToday } from "../store/apply-queue.js";
import { classifyApplyUrl } from "./platform.js";

export interface SafetyCheckResult {
  ok: boolean;
  checks: string[];
  error?: string;
}

export function runAutoApplySafetyChecks(
  url: string,
  applicationId: number,
): SafetyCheckResult {
  const checks: string[] = [];
  const profile = getDefaultProfile();
  const defaults = getApplyDefaults(profile.id);

  const platform = classifyApplyUrl(url);
  if (!platform.allowed) {
    return { ok: false, checks, error: platform.reason };
  }
  checks.push(`platform: ${platform.adapter_id}`);

  const submittedToday = countSubmissionsToday(profile.id);
  if (submittedToday >= defaults.max_applies_per_day) {
    return {
      ok: false,
      checks,
      error: `daily apply cap reached (${defaults.max_applies_per_day}/day)`,
    };
  }
  checks.push(`under daily cap (${submittedToday}/${defaults.max_applies_per_day})`);

  const app = getApplication(applicationId);
  if (!app) return { ok: false, checks, error: "application not found" };
  if (app.cv_id == null) return { ok: false, checks, error: "no cv_id on application" };
  if (app.status === "submitted") return { ok: false, checks, error: "already submitted" };

  if (app.match_score != null && app.match_score < defaults.min_match_score) {
    return {
      ok: false,
      checks,
      error: `match_score ${app.match_score} below minimum ${defaults.min_match_score}`,
    };
  }
  checks.push("match score threshold");

  const dup = listApplications(profile.id).find(
    (a) => a.job_id === app.job_id && a.id !== app.id && a.status === "submitted",
  );
  if (dup) {
    return { ok: false, checks, error: `duplicate submission for job (application ${dup.id})` };
  }
  checks.push("no duplicate submission");

  return { ok: true, checks };
}