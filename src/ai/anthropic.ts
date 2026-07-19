import type { AiContext, AiProvider, AiResult, AiUsage } from "./provider.js";
import { SYSTEM, tailorPrompt, coverPrompt, answerPrompt } from "./prompt.js";
import { costFor } from "./usage.js";

/**
 * Anthropic (Claude) provider. Uses fetch against the Messages API — no SDK dep.
 * Only loaded when AI_PROVIDER=anthropic and AI_API_KEY are set. Pro path.
 * Job/question content is framed as untrusted data via the shared prompt
 * builder (N1).
 */
export class AnthropicProvider implements AiProvider {
  name = "anthropic";
  constructor(
    private key: string,
    private model: string = "claude-3-5-sonnet-latest",
    private baseUrl: string = process.env.AI_BASE_URL ?? "https://api.anthropic.com",
    private version: string = "2023-06-01"
  ) {}

  private async complete(system: string, user: string): Promise<{ text: string; usage: AiUsage }> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.key,
        "anthropic-version": this.version,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Anthropic HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const block = data.content?.find((b) => b.type === "text");
    return {
      text: block?.text ?? "",
      usage: {
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
      },
    };
  }

  private build(text: string, usage: AiUsage, notes: string[]): AiResult {
    return { text, provider: this.name, notes, usage, cost_usd: costFor("anthropic", usage) };
  }

  async tailorCv(ctx: AiContext): Promise<AiResult> {
    const { text, usage } = await this.complete(SYSTEM, tailorPrompt(ctx));
    return this.build(text, usage, ["AI-drafted — verify every claim against your CV."]);
  }
  async coverLetter(ctx: AiContext): Promise<AiResult> {
    const { text, usage } = await this.complete(SYSTEM, coverPrompt(ctx));
    return this.build(text, usage, ["AI-drafted — review tone and facts."]);
  }
  async draftAnswer(ctx: AiContext): Promise<AiResult> {
    const { text, usage } = await this.complete(SYSTEM, answerPrompt(ctx));
    return this.build(text, usage, ["AI-drafted — confirm facts before sending."] );
  }
}