// Pure settings helpers for the one-click setup feature (v0.4.0).
//
// The app stores a tiny set of AI-related settings in the local SQLite `meta`
// kv table so the desktop UI can change them with a single click instead of
// editing environment variables. This module is PURE (no I/O, no process.env
// mutation) so it is unit-testable in isolation. The store layer
// (`src/store/settings.ts`) does the persistence + env application.
//
// Precedence: a persisted (non-empty) value overrides the environment; an empty
// persisted value falls back to the environment. This keeps env-only users
// (v0.3.0 and earlier) behaving identically — an empty `meta` table changes
// nothing.

export const SETTINGS_KEYS = [
  "ai_provider",
  "ai_model",
  "ai_base_url",
  "ai_api_key",
] as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[number];

export interface Settings {
  ai_provider: string;
  ai_model: string;
  ai_base_url: string;
  ai_api_key: string;
}

export const DEFAULT_SETTINGS: Settings = {
  ai_provider: "",
  ai_model: "",
  ai_base_url: "",
  ai_api_key: "",
};

/** Allowed AI provider ids. "" means "not configured" (fall back to env/mock). */
export const ALLOWED_PROVIDERS = ["", "mock", "ollama", "openai", "anthropic"] as const;

/**
 * A patch the UI sends. The API key is special: a `string` (incl. "") stores
 * the value verbatim, while `null` means "delete the row entirely" (full clear,
 * so the env fallback returns). All other keys accept a `string` only.
 */
export type SettingsPatch = {
  ai_provider?: string;
  ai_model?: string;
  ai_base_url?: string;
  ai_api_key?: string | null;
};

/**
 * A validated patch. For `ai_api_key`: a `string` (incl. "") is stored verbatim;
 * `null` means "delete the row entirely" (full clear → env fallback returns).
 * Other keys are `string` only. A key ABSENT from the patch means "leave
 * unchanged" (the store never writes absent keys).
 */
export type ValidatedPatch = {
  ai_provider?: string;
  ai_model?: string;
  ai_base_url?: string;
  ai_api_key?: string | null;
};

export type ValidationResult =
  | { ok: true; value: ValidatedPatch }
  | { ok: false; error: string };

/**
 * Validate + normalise a settings patch. Trims strings, lower-cases the
 * provider, rejects unknown providers and non-http(s) base URLs, and rejects
 * newlines in the model id. An empty string is valid for every field (it means
 * "store empty / fall back to env"). `null` is valid ONLY for `ai_api_key` and
 * is preserved as `null` so the store can delete the row.
 */
export function validateSettings(input: Partial<SettingsPatch>): ValidationResult {
  const out: ValidatedPatch = {};

  if ("ai_provider" in input) {
    const v = String(input.ai_provider ?? "").trim().toLowerCase();
    if (!(ALLOWED_PROVIDERS as readonly string[]).includes(v)) {
      return { ok: false, error: `unknown AI provider: "${v}"` };
    }
    out.ai_provider = v;
  }

  if ("ai_model" in input) {
    const v = String(input.ai_model ?? "").trim();
    if (/\n|\r/.test(v)) return { ok: false, error: "ai_model must not contain newlines" };
    out.ai_model = v;
  }

  if ("ai_base_url" in input) {
    const v = String(input.ai_base_url ?? "").trim();
    if (v !== "" && !/^https?:\/\//i.test(v)) {
      return { ok: false, error: "ai_base_url must start with http:// or https://" };
    }
    out.ai_base_url = v;
  }

  if ("ai_api_key" in input) {
    if (input.ai_api_key === null || input.ai_api_key === undefined) {
      out.ai_api_key = null; // store deletes the row
    } else {
      out.ai_api_key = String(input.ai_api_key);
    }
  }

  return { ok: true, value: out };
}

/** Whether a key value is considered "set" (non-empty). */
export function isKeySet(key: string): boolean {
  return typeof key === "string" && key.length > 0;
}

/**
 * Mask an API key for display. Long keys show the first 3 and last 4 chars;
 * short keys collapse to "•••• set" so we never echo most of a weak key. Empty
 * keys report "not set". The raw key is NEVER returned by any read path.
 */
export function maskApiKey(key: string): string {
  if (!isKeySet(key)) return "not set";
  if (key.length < 8) return "•••• set";
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}

/**
 * Resolve the EFFECTIVE settings: persisted (non-empty) wins over the provided
 * env map; empty persisted values fall back to env. Pure — the env map is
 * passed in so tests don't have to mutate `process.env`.
 */
export function effectiveSettings(
  persisted: Settings,
  env: Record<string, string | undefined> = {}
): Settings {
  const pick = (p: string, envName: string) =>
    isKeySet(p) ? p : (env[envName] ?? "");
  return {
    ai_provider: pick(persisted.ai_provider, "AI_PROVIDER"),
    ai_model: pick(persisted.ai_model, "AI_MODEL"),
    ai_base_url: pick(persisted.ai_base_url, "AI_BASE_URL"),
    ai_api_key: pick(persisted.ai_api_key, "AI_API_KEY"),
  };
}

/** The effective provider id, defaulting to "mock" when nothing is configured. */
export function effectiveProvider(persisted: Settings, env: Record<string, string | undefined> = {}): string {
  const eff = effectiveSettings(persisted, env);
  return eff.ai_provider || "mock";
}