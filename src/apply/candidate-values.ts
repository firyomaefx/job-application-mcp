import { getDefaultProfile } from "../store/profile.js";
import { getApplication } from "../store/applications.js";
import type { Application } from "../lib/types.js";
import { getApplyDefaults } from "../store/apply-defaults.js";

/** Profile + application + stored apply-default answers for form mapping. */
export function buildCandidateValues(app: Application): Record<string, string> {
  const profile = getDefaultProfile();
  const defaults = getApplyDefaults(profile.id);
  return {
    full_name: profile.full_name,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    location: profile.location ?? "",
    headline: profile.headline ?? "",
    cover_letter: app.cover_letter ?? "",
    ...defaults.answers,
    ...(app.answers ?? {}),
  };
}

export function candidateValuesForApplication(applicationId: number): Record<string, string> | null {
  const app = getApplication(applicationId);
  if (!app) return null;
  return buildCandidateValues(app);
}