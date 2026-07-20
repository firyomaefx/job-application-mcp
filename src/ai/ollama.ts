import { OpenAiProvider } from "./openai.js";
import type { ProviderName } from "./usage.js";

/**
 * Ollama provider — a local, OpenAI-compatible model server
 * (https://github.com/ollama/ollama). Ollama exposes an OpenAI-shaped
 * `/v1/chat/completions` endpoint, so we reuse the OpenAI provider's transport
 * and only override the identity, default model/base URL, and cost key.
 *
 * Ollama needs **no API key** — it runs on the user's own machine. We pass a
 * placeholder bearer token that Ollama ignores, so the parent transport stays
 * unchanged. The cost key is `ollama` → cost 0 (local model, no per-token fee).
 *
 * Selected when `AI_PROVIDER=ollama` (see `getProvider`). Job/CV content stays
 * wrapped in `<untrusted>` via the shared prompt builder (N1) — a local model
 * can still be an instruction-injection vector via hostile job text.
 */
export class OllamaProvider extends OpenAiProvider {
  name = "ollama";
  protected priceKey: ProviderName = "ollama";
  constructor(
    model: string = process.env.AI_MODEL ?? "llama3.1",
    baseUrl: string = process.env.AI_BASE_URL ?? "http://localhost:11434/v1"
  ) {
    // Ollama ignores the Authorization header; pass a harmless placeholder.
    super("ollama", model, baseUrl);
  }
}