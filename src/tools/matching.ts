import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile } from "../store/profile.js";
import { getCv, getJob, saveApplication } from "../store/applications.js";
import { extractKeywords, scoreMatch } from "../lib/scoring.js";
import { getProvider, type AiContext, type AiProvider } from "../ai/provider.js";
import { resolveAiMode } from "../features.js";
import { runAiOp } from "../ai/guard.js";
import type { AiFeature } from "../ai/usage.js";

/**
 * Resolve the AI provider for a tool call.
 *
 * - A user who supplies their own API key (AI_API_KEY) gets the real provider,
 *   whether on the Free or Pro plan. This honours the free-core guarantee that
 *   users can use their own Claude/OpenAI key.
 * - `proHosted` is true only on the Pro hosted path (Pro entitlement + balance).
 *   The actual credit debit happens in `runAiOp` ON SUCCESS — never on fallback
 *   or failure. Free users with their own key are never debited.
 * - With no key, fall back to the local heuristic (mock) provider.
 */
export async function resolveProvider(
  feature: string,
): Promise<{ provider: AiProvider; usedAi: boolean; proHosted: boolean }> {
  const haveKey = !!process.env.AI_API_KEY;
  // Ollama is a keyless local model — still counts as "used AI" (real provider),
  // but never as Pro hosted (no server-side credit path).
  const isOllama = process.env.AI_PROVIDER?.toLowerCase() === "ollama";
  const mode = resolveAiMode(feature); // 'ai' only when Pro entitlement + balance
  const usedAi = haveKey || isOllama;
  const proHosted = mode === "ai" && haveKey && !isOllama;
  const provider = await getProvider({ useReal: usedAi });
  return { provider, usedAi, proHosted };
}

function buildContext(job: { title: string; description: string; keywords: string[] }, cvText: string, question?: string): AiContext {
  const profile = getDefaultProfile();
  const cvSkills = extractKeywords(cvText, 30);
  return {
    jobTitle: job.title,
    jobDescription: job.description,
    jobKeywords: job.keywords,
    cvText,
    candidateSkills: Array.from(new Set([...profile.skills, ...cvSkills])),
    question,
  };
}

const matchCvSchema = z.object({
  job_id: z.number().int(),
  cv_id: z.number().int(),
  save: z.boolean().optional().default(false),
});

export const matchCvTool: ToolDef<typeof matchCvSchema> = {
  name: "match_cv",
  description:
    "Score a stored CV against a stored job (0-100) and list matched / missing skills. " +
    "Optionally create a draft application record with the score.",
  inputSchema: matchCvSchema,
  run: async (input) => {
    const job = getJob(input.job_id);
    if (!job) return { summary: `Job ${input.job_id} not found.` };
    const cv = getCv(input.cv_id);
    if (!cv) return { summary: `CV ${input.cv_id} not found.` };

    const profile = getDefaultProfile();
    const cvSkills = extractKeywords(cv.text, 30);
    const candidateSkills = Array.from(new Set([...profile.skills, ...cvSkills]));

    const result = scoreMatch(candidateSkills, job.keywords);

    let applicationId: number | null = null;
    if (input.save) {
      const app = saveApplication({
        profile_id: profile.id,
        job_id: job.id,
        cv_id: cv.id,
        match_score: result.score,
        status: "draft",
      });
      applicationId = app.id;
    }

    return {
      summary: `Match score ${result.score}/100 for "${job.title}" vs CV "${cv.label}".`,
      data: {
        application_id: applicationId,
        score: result.score,
        matched: result.matched,
        missing: result.missing,
        extra: result.extra,
      },
      notes: result.notes,
    };
  },
};

const tailorCvSchema = z.object({
  job_id: z.number().int(),
  cv_id: z.number().int(),
});

export const tailorCvTool: ToolDef<typeof tailorCvSchema> = {
  name: "tailor_cv",
  description:
    "Tailor a CV toward a job. With your own AI API key (AI_API_KEY, free or Pro): " +
    "AI-rewritten prose. Without a key: heuristic structural draft (local). " +
    "The Pro hosted path debits one AI credit; free use of your own key is never debited.",
  inputSchema: tailorCvSchema,
  run: async (input) => {
    const job = getJob(input.job_id);
    if (!job) return { summary: `Job ${input.job_id} not found.` };
    const cv = getCv(input.cv_id);
    if (!cv) return { summary: `CV ${input.cv_id} not found.` };

    const { provider, usedAi, proHosted } = await resolveProvider("ai_cv_tailoring");
    const ctx = buildContext(job, cv.text);
    const { result, debited, status } = await runAiOp(
      "ai_cv_tailoring" as AiFeature, "ai_tailor", String(input.job_id), provider, usedAi, proHosted, ctx, "tailorCv",
    );

    return {
      summary: `Tailored CV draft for "${job.title}" (${labelFor(usedAi, status, result.provider)}, provider: ${result.provider}${debited ? ", 1 credit debited" : ""}).`,
      data: { text: result.text, mode: result.provider === "mock" ? "heuristic" : "ai", status, usage: result.usage, cost_usd: result.cost_usd },
      notes: result.notes,
    };
  },
};

const coverLetterSchema = z.object({
  job_id: z.number().int(),
  cv_id: z.number().int(),
});

export const coverLetterTool: ToolDef<typeof coverLetterSchema> = {
  name: "cover_letter",
  description:
    "Draft a cover letter for a job. With your own AI API key (AI_API_KEY, free or Pro): " +
    "full AI-drafted prose. Without a key: heuristic scaffold (local). " +
    "The Pro hosted path debits one AI credit; free use of your own key is never debited.",
  inputSchema: coverLetterSchema,
  run: async (input) => {
    const job = getJob(input.job_id);
    if (!job) return { summary: `Job ${input.job_id} not found.` };
    const cv = getCv(input.cv_id);
    if (!cv) return { summary: `CV ${input.cv_id} not found.` };

    const { provider, usedAi, proHosted } = await resolveProvider("ai_cover_letter");
    const ctx = buildContext(job, cv.text);
    const { result, debited, status } = await runAiOp(
      "ai_cover_letter" as AiFeature, "ai_cover", String(input.job_id), provider, usedAi, proHosted, ctx, "coverLetter",
    );

    return {
      summary: `Cover letter draft for "${job.title}" (${labelFor(usedAi, status, result.provider)}, provider: ${result.provider}${debited ? ", 1 credit debited" : ""}).`,
      data: { text: result.text, mode: result.provider === "mock" ? "heuristic" : "ai", status, usage: result.usage, cost_usd: result.cost_usd },
      notes: result.notes,
    };
  },
};

const draftAnswerSchema = z.object({
  question: z.string().min(5),
  cv_id: z.number().int().optional(),
  job_id: z.number().int().optional(),
});

export const draftAnswerTool: ToolDef<typeof draftAnswerSchema> = {
  name: "draft_answer",
  description:
    "Draft a screening-answer starter. With your own AI API key (AI_API_KEY, free or Pro): " +
    "AI-drafted answer from verified CV facts. Without a key: heuristic template (local). " +
    "Always review before use. The Pro hosted path debits one AI credit; free use of your own key is never debited.",
  inputSchema: draftAnswerSchema,
  run: async (input) => {
    const cv = input.cv_id ? getCv(input.cv_id) : null;
    const job = input.job_id ? getJob(input.job_id) : null;
    const cvText = cv?.text ?? "";
    const ctxJob = job ?? { title: "the role", description: "", keywords: [] as string[] };

    const { provider, usedAi, proHosted } = await resolveProvider("ai_answer");
    const ctx = buildContext(ctxJob, cvText, input.question);
    const { result, debited, status } = await runAiOp(
      "ai_answer" as AiFeature, "ai_answer", String(input.job_id ?? ""), provider, usedAi, proHosted, ctx, "draftAnswer",
    );

    return {
      summary: `Drafted answer (${labelFor(usedAi, status, result.provider)}, provider: ${result.provider}${debited ? ", 1 credit debited" : ""}).`,
      data: { question: input.question, text: result.text, mode: result.provider === "mock" ? "heuristic" : "ai", status, usage: result.usage, cost_usd: result.cost_usd },
      notes: result.notes,
    };
  },
};

/** Human label: 'AI', 'heuristic', or 'AI→heuristic fallback'. */
function labelFor(usedAi: boolean, status: string, providerName: string): string {
  if (!usedAi) return "heuristic";
  if (status === "fallback" || providerName === "mock") return "AI→heuristic fallback";
  return "AI";
}