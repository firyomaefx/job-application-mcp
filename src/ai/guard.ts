// AI call guard — wraps a provider op with cost controls and resilience
// (N2/N3/N4):
//   - monthly spend cap → fall back to heuristic when exceeded (N3)
//   - rate limit (min interval between real calls) (N3)
//   - bounded retries with backoff, then heuristic fallback (N3/N4)
//   - token-usage + cost recording per call (N2)
//   - credit debit only on a successful real (Pro hosted) call — never on
//     fallback or failure, so a failed real-AI request never costs a credit or
//     loses application progress (N4).
//
// The op is selected by name so the same guard can run it on the real provider
// or on a fresh MockProvider for fallback.

import type { AiContext, AiProvider, AiResult } from "./provider.js";
import { MockProvider } from "./mock.js";
import {
  canSpend,
  enforceRateLimit,
  maxRetries,
  recordUsage,
  type AiFeature,
  type AiStatus,
  type ProviderName,
} from "./usage.js";
import { tryDebit } from "../licence/credits.js";

type OpName = "tailorCv" | "coverLetter" | "draftAnswer";
type DebitReason = "ai_tailor" | "ai_cover" | "ai_answer";

export interface AiRunResult {
  result: AiResult;
  /** True only if a Pro-hosted credit was actually debited for this call. */
  debited: boolean;
  /** 'ok' | 'fallback' (fell back to heuristic) | 'failed'. */
  status: AiStatus;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function callOp(p: AiProvider, op: OpName, ctx: AiContext): Promise<AiResult> {
  return p[op](ctx);
}

/**
 * Run an AI op with the full guard. `usedAi` = a real provider was selected
 * (own key or Pro hosted). `proHosted` = the Pro hosted path intended (debit
 * on success). When the real path fails or the spend cap is hit, we fall back
 * to the local heuristic mock so the caller still gets a usable draft.
 */
export async function runAiOp(
  feature: AiFeature,
  reason: DebitReason,
  ref: string,
  provider: AiProvider,
  usedAi: boolean,
  proHosted: boolean,
  ctx: AiContext,
  op: OpName,
): Promise<AiRunResult> {
  // Pure mock path (no key, free heuristic) — no debit, no spend check.
  if (!usedAi) {
    const result = await callOp(provider, op, ctx);
    recordUsage(feature, "mock", result.usage ?? { input_tokens: 0, output_tokens: 0 }, "ok");
    return { result, debited: false, status: "ok" };
  }

  // Real provider path — but if the monthly spend cap is hit, degrade gracefully.
  if (!canSpend()) {
    const result = await callOp(new MockProvider(), op, ctx);
    recordUsage(feature, "mock", result.usage ?? { input_tokens: 0, output_tokens: 0 }, "fallback");
    return { result, debited: false, status: "fallback" };
  }

  const retries = maxRetries();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await enforceRateLimit();
      const result = await callOp(provider, op, ctx);
      const debited = proHosted ? tryDebit(reason, ref) : false;
      recordUsage(
        feature,
        provider.name as ProviderName,
        result.usage ?? { input_tokens: 0, output_tokens: 0 },
        "ok",
      );
      return { result, debited, status: "ok" };
    } catch {
      if (attempt < retries) await sleep(100 * 2 ** attempt);
    }
  }

  // Exhausted retries → heuristic fallback. No debit, no progress lost.
  const result = await callOp(new MockProvider(), op, ctx);
  recordUsage(feature, "mock", result.usage ?? { input_tokens: 0, output_tokens: 0 }, "fallback");
  return { result, debited: false, status: "fallback" };
}