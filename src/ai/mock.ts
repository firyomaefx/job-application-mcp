import type { AiContext, AiProvider, AiResult } from "./provider.js";
import { estimateUsage } from "./usage.js";

/**
 * Mock provider — fully local, no network. Upgraded heuristics over the bare
 * free-core suggestions. Used both as the free fallback and in tests.
 * Reports deterministic estimated usage so cost-control tests run without any
 * paid API call.
 */
export class MockProvider implements AiProvider {
  name = "mock";

  private result(text: string, notes: string[], ctx: AiContext): AiResult {
    const inputText = `${ctx.jobTitle} ${ctx.jobDescription} ${ctx.question ?? ""} ${ctx.cvText}`;
    return { text, provider: this.name, notes, usage: estimateUsage(inputText, text), cost_usd: 0 };
  }

  async tailorCv(ctx: AiContext): Promise<AiResult> {
    const cvSkills = new Set(ctx.cvText.toLowerCase().split(/\W+/));
    const surface = ctx.jobKeywords.filter((k) => cvSkills.has(k.toLowerCase()));
    const missing = ctx.jobKeywords.filter((k) => !cvSkills.has(k.toLowerCase()));

    const text =
      `Tailored CV draft for "${ctx.jobTitle}" (heuristic):\n\n` +
      `1. Lead with a summary line naming the role and your top 3 matched skills: ${surface.slice(0, 3).join(", ") || "(none matched)"}.\n` +
      `2. Reorder experience so the most relevant bullet points come first.\n` +
      `3. Mirror job language: ${ctx.jobKeywords.slice(0, 6).join(", ")}.\n` +
      (missing.length ? `4. Where you can truthfully evidence: ${missing.slice(0, 6).join(", ")}. Otherwise omit.\n` : "") +
      `5. Add a quantified achievement (number / % / timeline) near the top.\n\n` +
      `This is a structural draft. Verify every claim against your real experience.`;

    return this.result(text, ["Heuristic draft — no AI call made.", "Pro with AI provider enabled rewrites prose."], ctx);
  }

  async coverLetter(ctx: AiContext): Promise<AiResult> {
    const text =
      `Cover letter scaffold for "${ctx.jobTitle}" (heuristic):\n\n` +
      `Dear Hiring Team,\n\n` +
      `I'm writing to apply for the ${ctx.jobTitle} role. My background in ${ctx.candidateSkills.slice(0, 3).join(", ")} aligns with your needs around ${ctx.jobKeywords.slice(0, 4).join(", ")}.\n\n` +
      `[Paragraph 2: one concrete accomplishment that proves fit.]\n` +
      `[Paragraph 3: why this company specifically.]\n\n` +
      `Thank you for your time.\n[Your name]`;

    return this.result(text, ["Heuristic scaffold — fill the bracketed sections.", "Pro with AI provider drafts full prose."], ctx);
  }

  async draftAnswer(ctx: AiContext): Promise<AiResult> {
    const text =
      `Draft answer to: "${ctx.question ?? "(no question)"}" (heuristic):\n\n` +
      `[Open with a direct one-sentence answer.]\n` +
      `Relevant skills: ${ctx.candidateSkills.slice(0, 4).join(", ") || "(set profile skills)"}.\n` +
      `[One concrete example with a measurable outcome.]\n` +
      `[Close with relevance to the ${ctx.jobTitle} role.]\n\n` +
      `Verify every claim. Heuristic draft only.`;

    return this.result(text, ["Heuristic template — rewrite before use."], ctx);
  }
}