// System detection for the one-click setup feature (v0.4.0).
//
// `buildSystemReport` is the single source of truth for "what's available
// right now" — used by both the bridge `GET /detect` endpoint and the
// `system_check` MCP tool, so they always report the same shape. The only
// network touch is the loopback Ollama probe (keyless). No third-party calls,
// no CV/PII in the report.

import { probeOllama } from "./detect-probe.js";
import { readAllSettings, applyPersistedSettingsToEnv } from "../store/settings.js";
import {
  effectiveSettings,
  effectiveProvider,
  maskApiKey,
  isKeySet,
  type Settings,
} from "./settings.js";
import { getDefaultProfile } from "../store/profile.js";
import { listCvs } from "../store/profile.js";
import { listApplications } from "../store/applications.js";
import { statusSnapshot } from "../features.js";
import { dbPath } from "../store/db.js";

export interface SystemReport {
  bridge: { status: string; port: number };
  ai: {
    effective_provider: string;
    configured_provider: string;
    ollama_reachable: boolean;
    ollama_models?: string[];
    key_present: boolean;
    key_masked: string;
    model: string;
    base_url: string;
  };
  data: { profile_present: boolean; cv_count: number; application_count: number; db_path: string };
  plan: { plan_label: string; credits: number };
}

/** Resolve the Ollama base URL to probe from the effective settings/env. */
function ollamaBaseUrl(eff: Settings): string {
  if (isKeySet(eff.ai_base_url) && /11434|ollama/i.test(eff.ai_base_url)) {
    return eff.ai_base_url;
  }
  // Ollama's OpenAI-compatible endpoint by default.
  return process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
}

/**
 * Build the SystemReport. `applyEnv` defaults true so a freshly-booted bridge
 * applies persisted settings to env before reading the effective provider —
 * giving an accurate "effective_provider". Tests may pass false to inspect
 * env-only state without side effects.
 */
export async function buildSystemReport(opts: {
  bridgeStatus: string;
  port: number;
  applyEnv?: boolean;
}): Promise<SystemReport> {
  if (opts.applyEnv !== false) applyPersistedSettingsToEnv();

  const persisted = readAllSettings();
  const env = process.env as Record<string, string | undefined>;
  const eff = effectiveSettings(persisted, env);
  const provider = effectiveProvider(persisted, env);

  // Only probe Ollama if it could plausibly be the chosen/available provider —
  // avoids a pointless 1.5s wait when the user is clearly on mock/openai.
  let ollama = { reachable: false } as { reachable: boolean; models?: string[] };
  if (provider === "ollama" || !isKeySet(eff.ai_provider)) {
    ollama = await probeOllama(ollamaBaseUrl(eff));
  }

  // Profile / CV / application presence (free core: single default profile).
  // getDefaultProfile auto-creates with full_name "Unnamed Candidate", so treat
  // that placeholder (or an empty name) as "not yet set up" unless the user
  // added an email or headline.
  let profilePresent = false;
  let cvCount = 0;
  let applicationCount = 0;
  try {
    const profile = getDefaultProfile();
    const named = !!profile.full_name && profile.full_name !== "Unnamed Candidate";
    profilePresent = named || !!profile.email || !!profile.headline;
    cvCount = (listCvs(profile.id) as unknown[]).length;
    applicationCount = (listApplications(profile.id) as unknown[]).length;
  } catch {
    // DB not open yet / empty — report zeros, don't crash the report.
  }

  const snap = statusSnapshot();

  return {
    bridge: { status: opts.bridgeStatus, port: opts.port },
    ai: {
      effective_provider: provider,
      configured_provider: persisted.ai_provider,
      ollama_reachable: ollama.reachable,
      ollama_models: ollama.models,
      key_present: isKeySet(eff.ai_api_key),
      key_masked: maskApiKey(eff.ai_api_key),
      model: eff.ai_model,
      base_url: eff.ai_base_url,
    },
    data: {
      profile_present: profilePresent,
      cv_count: cvCount,
      application_count: applicationCount,
      db_path: dbPath(),
    },
    plan: { plan_label: snap.plan_label, credits: snap.ai_credits_balance },
  };
}