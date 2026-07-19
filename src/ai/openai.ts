import type { AiContext, AiProvider, AiResult, AiUsage } from "./provider.js";
import { SYSTEM, tailorPrompt, coverPrompt, answerPrompt } from "./prompt.js";
import { costFor } from "./usage.js";

/**
 * OpenAI provider. Uses fetch against the OpenAI chat completions endpoint —
 * no SDK dep. Only loaded when AI_PROVIDER=openai and AI_API_KEY are set.
 *
 * This is a Pro path: the caller debits a credit before invoking. Job/question
 * content is framed as untrusted data via the shared prompt builder (N1).
 */
export class OpenAiProvider implements AiProvider {
  name = "openai";
  constructor(
    private key: string,
    private model: string = "gpt-4o-mini",
    private baseUrl: string = process.env.AI_BASE_URL ?? "https://api.openai.com/v1"
  ) {}

  private async complete(system: string, user: string): Promise<{ text: string; usage: AiUsage }> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      usage: {
        input_tokens: data.usage?.prompt_tokens ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  private build(text: string, usage: AiUsage, notes: string[]): AiResult {
    return { text, provider: this.name, notes, usage, cost_usd: costFor("openai", usage) };
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
    return this.build(text, usage, ["AI-drafted — confirm facts before sending."]);
  }
}