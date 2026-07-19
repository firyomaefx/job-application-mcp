// AI provider abstraction.
//
// The free core ships a `mock` provider that does upgraded heuristic tailoring
// fully locally (no network). When a Pro entitlement + API key are configured,
// the real `openai` or `anthropic` provider is used and a credit is debited.
//
// Providers are selected at call time via `getProvider()`, so config changes
// apply without restart. The interface is intentionally minimal: each AI op is
// a single function returning text + a short note.

export interface AiContext {
  jobTitle: string;
  jobDescription: string;
  jobKeywords: string[];
  cvText: string;
  candidateSkills: string[];
  question?: string;
}

export interface AiResult {
  text: string;
  provider: string;
  notes: string[];
}

export interface AiProvider {
  name: string;
  tailorCv(ctx: AiContext): Promise<AiResult>;
  coverLetter(ctx: AiContext): Promise<AiResult>;
  draftAnswer(ctx: AiContext): Promise<AiResult>;
}

/**
 * Pick a provider based on env + entitlement. Order: configured real provider
 * (if key present AND ai mode) → mock. The caller (tool) decides whether to
 * debit a credit.
 */
export async function getProvider(opts: { useReal: boolean }): Promise<AiProvider> {
  if (opts.useReal) {
    const provider = process.env.AI_PROVIDER?.toLowerCase();
    const key = process.env.AI_API_KEY;
    if (provider === "anthropic" && key) {
      return new (await import("./anthropic.js")).AnthropicProvider(key, process.env.AI_MODEL);
    }
    if (provider === "openai" && key) {
      return new (await import("./openai.js")).OpenAiProvider(key, process.env.AI_MODEL);
    }
  }
  return new (await import("./mock.js")).MockProvider();
}