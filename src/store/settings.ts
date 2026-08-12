// Persisted AI settings store (v0.4.0 one-click setup).
//
// Uses the existing additive `meta` kv table — no migration, no collision with
// `schema_version` (settings live under `ai_*` keys). A persisted non-empty
// value overrides the process environment; an empty persisted value falls back
// to the environment. This keeps env-only users (v0.3.0 and earlier) identical.
//
// Security: non-secret preferences are persisted. Provider API keys are
// session-only (or supplied through the process environment) and are never
// written to SQLite. Older plaintext ai_api_key rows are removed on startup.

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
    // Deliberately do not expose a legacy plaintext row as a setting.
    ai_api_key: "",
  };
}

/**
 * Apply a validated patch. Non-secret preferences persist. `ai_api_key` is
 * never persisted; any legacy row is deleted. The HTTP layer applies a key to
 * the current process separately through `applySessionSecretToEnv`.
 * Absent keys are left untouched. Returns the full settings after write.
 */
export function writeSettings(patch: ValidatedPatch): Settings {
  if ("ai_provider" in patch) setSetting("ai_provider", patch.ai_provider ?? "");
  if ("ai_model" in patch) setSetting("ai_model", patch.ai_model ?? "");
  if ("ai_base_url" in patch) setSetting("ai_base_url", patch.ai_base_url ?? "");
  if ("ai_api_key" in patch) {
    clearSetting("ai_api_key");
  }
  return readAllSettings();
}

/** Apply a provider key only to the current process and purge legacy storage. */
export function applySessionSecretToEnv(
  value: string | null,
  env: NodeJS.ProcessEnv = process.env
): void {
  clearSetting("ai_api_key");
  if (isKeySet(value ?? "")) env.AI_API_KEY = value!;
  else delete env.AI_API_KEY;
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
  // Purge keys written by v0.4.0/v0.4.1 before applying safe preferences.
  clearSetting("ai_api_key");
  const map: Partial<Record<SettingsKey, string>> = {
    ai_provider: "AI_PROVIDER",
    ai_model: "AI_MODEL",
    ai_base_url: "AI_BASE_URL",
  };
  for (const key of SETTINGS_KEYS) {
    const envName = map[key];
    if (!envName) continue;
    const persisted = settings[key];
    if (isKeySet(persisted)) {
      env[envName] = persisted;
      applied.push(key);
    }
  }
  return { applied };
}
