// Entitlement-activity log (N7). Records activation, renewal, expiry, and
// downgrade events so plan transitions are auditable locally. This is a
// Free-core local log only — it is NOT the server-side entitlement authority
// (which remains deferred, see M4).

import { openDb } from "../store/db.js";
import { getDefaultProfile } from "../store/profile.js";
import type { Plan } from "../lib/entitlement.js";

export type EntitlementEvent = "activate" | "renew" | "expire" | "downgrade" | "clear";

function nowIso(): string {
  return new Date().toISOString();
}

/** Record an entitlement event for the default profile. */
export function recordEvent(event: EntitlementEvent, plan: Plan | null, detail?: string): void {
  const db = openDb();
  const profileId = getDefaultProfile().id;
  db.prepare(
    "INSERT INTO entitlement_events (profile_id, event, plan, detail, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(profileId, event, plan ?? null, detail ?? null, nowIso());
}

/** List entitlement events (newest first). */
export function listEntitlementEvents(limit = 50) {
  const db = openDb();
  const profileId = getDefaultProfile().id;
  return db
    .prepare(
      "SELECT id, event, plan, detail, created_at FROM entitlement_events WHERE profile_id = ? ORDER BY id DESC LIMIT ?",
    )
    .all(profileId, limit);
}