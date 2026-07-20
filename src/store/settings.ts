// Persisted AI settings store (v0.4.0 one-click setup).
//
// Uses the existing additive `meta` kv table — no migration, no collision with
// `schema_version` (settings live under `ai_*` keys). A persisted non-empty
// value overrides the process environment; an empty persisted value falls back
// to the environment. This keeps env-only users (v0.3.0 and earlier) identical.
//
// Security: the API key is the user's own, stored on their own machine, behind
// a loopback-only bridge. It is never logged here (applyPersistedSettingsToEnv
// returns only key NAMES, not values) and never sent off-machine.

import { openDb } from "./db.js";
import {
  SETTINGS_KEYS,
  type Settings,
  type SettingsKey,
  type ValidatedPatch,
  isKeySet,
} from "../lib/settings.js";

/** Read one setting ("" if unset). */
export function getSetting(key: SettingsKey): string {
  const db = openDb();
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? "";
}

/** Store one setting verbatim (empty string is stored as empty, not deleted). */
export function setSetting(key: SettingsKey, value: string): void {
  const db = openDb();
  db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)").run(key, value);
}

/** Fully remove a setting row (env fallback then applies). */
export function clearSetting(key: SettingsKey): void {
  const db = openDb();
  db.prepare("DELETE FROM meta WHERE key = ?").run(key);
}

/** Read all four AI settings, filling missing keys with "". */
export function readAllSettings(): Settings {
  return {
    ai_provider: getSetting("ai_provider"),
    ai_model: getSetting("ai_model"),
    ai_base_url: getSetting("ai_base_url"),
    ai_api_key: getSetting("ai_api_key"),
  };
}

/**
 * Apply a validated patch. For `ai_api_key`: `null` deletes the row (full
 * clear), a `string` (incl. "") stores it verbatim. Other keys store verbatim.
 * Absent keys are left untouched. Returns the full settings after write.
 */
export function writeSettings(patch: ValidatedPatch): Settings {
  if ("ai_provider" in patch) setSetting("ai_provider", patch.ai_provider ?? "");
  if ("ai_model" in patch) setSetting("ai_model", patch.ai_model ?? "");
  if ("ai_base_url" in patch) setSetting("ai_base_url", patch.ai_base_url ?? "");
  if ("ai_api_key" in patch) {
    if (patch.ai_api_key === null) clearSetting("ai_api_key");
    else setSetting("ai_api_key", patch.ai_api_key ?? "");
  }
  return readAllSettings();
}

/**
 * Push persisted settings into `process.env` so the AI provider layer
 * (`getProvider`, `resolveProvider`) — which reads `process.env` at call time —
 * picks them up on the NEXT tool call, with no restart.
 *
 * Precedence: a persisted non-empty value overrides env; an empty persisted
 * value leaves env untouched (fallback). Nothing is ever UNSET here, so an
 * empty `meta` table means behaviour is identical to v0.3.0.
 *
 * Returns the list of key NAMES applied (no values — nothing sensitive logged).
 */
export function applyPersistedSettingsToEnv(
  env: NodeJS.ProcessEnv = process.env
): { applied: string[] } {
  const settings = readAllSettings();
  const applied: string[] = [];
  const map: Record<SettingsKey, string> = {
    ai_provider: "AI_PROVIDER",
    ai_model: "AI_MODEL",
    ai_base_url: "AI_BASE_URL",
    ai_api_key: "AI_API_KEY",
  };
  for (const key of SETTINGS_KEYS) {
    const persisted = settings[key];
    if (isKeySet(persisted)) {
      env[map[key]] = persisted;
      applied.push(key);
    }
  }
  return { applied };
}