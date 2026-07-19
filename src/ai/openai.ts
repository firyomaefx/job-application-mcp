import type { AiContext, AiProvider, AiResult } from "./provider.js";

/**
 * OpenAI provider. Uses fetch against the OpenAI chat completions endpoint —
 * no SDK dep. Only loaded when AI_PROVIDER=openai and AI_API_KEY are set.
 *
 * This is a Pro path: the caller debits a credit before invoking.
 */
export class OpenAiProvider implements AiProvider {
  name = "openai";
  constructor(
    private key: string,
    private model: string = "gpt-4o-mini",
    private baseUrl: string = process.env.AI_BASE_URL ?? "https://api.openai.com/v1"
  ) {}

  private async complete(system: string, user: string): Promise<string> {
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
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  async tailorCv(ctx: AiContext): Promise<AiResult> {
    const text = await this.complete(SYSTEM, tailorPrompt(ctx));
    return { text, provider: this.name, notes: ["AI-drafted — verify every claim against your CV."] };
  }
  async coverLetter(ctx: AiContext): Promise<AiResult> {
    const text = await this.complete(SYSTEM, coverPrompt(ctx));
    return { text, provider: this.name, notes: ["AI-drafted — review tone and facts."] };
  }
  async draftAnswer(ctx: AiContext): Promise<AiResult> {
    const text = await this.complete(SYSTEM, answerPrompt(ctx));
    return { text, provider: this.name, notes: ["AI-drafted — confirm facts before sending."] };
  }
}

const SYSTEM =
  "You are a careful career coach. Only use facts present in the candidate's CV or profile. " +
  "Never invent employers, dates, titles, or metrics. If information is missing, say so explicitly. " +
  "Keep output concise and professional.";

function tailorPrompt(ctx: AiContext): string {
  return (
    `Rewrite the CV summary and reorder the top experience bullets to target this role.\n\n` +
    `Job title: ${ctx.jobTitle}\nJob keywords: ${ctx.jobKeywords.join(", ")}\n` +
    `Candidate CV:\n${ctx.cvText.slice(0, 4000)}\n\nCandidate skills: ${ctx.candidateSkills.join(", ")}`
  );
}
function coverPrompt(ctx: AiContext): string {
  return (
    `Write a concise cover letter (3 short paragraphs) for this role using only facts from the CV.\n\n` +
    `Job: ${ctx.jobTitle}\nJob description excerpt: ${ctx.jobDescription.slice(0, 1200)}\n` +
    `CV:\n${ctx.cvText.slice(0, 4000)}`
  );
}
function answerPrompt(ctx: AiContext): string {
  return (
    `Draft a 120-150 word answer to this screening question using only verified CV facts.\n\n` +
    `Question: ${ctx.question ?? "(none)"}\nRole: ${ctx.jobTitle}\n` +
    `CV:\n${ctx.cvText.slice(0, 3000)}`
  );
}