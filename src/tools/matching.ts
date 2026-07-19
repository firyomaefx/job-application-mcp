import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile } from "../store/profile.js";
import { getCv, getJob, saveApplication } from "../store/applications.js";
import { extractKeywords, scoreMatch } from "../lib/scoring.js";
import { getProvider, type AiContext, type AiProvider } from "../ai/provider.js";
import { resolveAiMode } from "../features.js";
import { tryDebit } from "../licence/credits.js";

/**
 * Resolve the AI provider for a tool call.
 *
 * - A user who supplies their own API key (AI_API_KEY) gets the real provider,
 *   whether on the Free or Pro plan. This honours the free-core guarantee that
 *   users can use their own Claude/OpenAI key.
 * - The Pro *hosted* path additionally debits an AI credit (when a Pro
 *   entitlement + balance exist). Free users with their own key are never
 *   debited (no credits, no hosted quota).
 * - With no key, fall back to the local heuristic (mock) provider.
 */
export async function resolveProvider(
  feature: string,
  reason: "ai_tailor" | "ai_cover" | "ai_answer",
  ref: string,
): Promise<{ provider: AiProvider; usedAi: boolean; debited: boolean }> {
  const haveKey = !!process.env.AI_API_KEY;
  const mode = resolveAiMode(feature); // 'ai' only when Pro entitlement + balance
  const usedAi = haveKey;
  const debited = mode === "ai" && haveKey && tryDebit(reason, ref);
  const provider = await getProvider({ useReal: usedAi });
  return { provider, usedAi, debited };
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

    const { provider, usedAi, debited } = await resolveProvider("ai_cv_tailoring", "ai_tailor", String(input.job_id));
    const result = await provider.tailorCv(buildContext(job, cv.text));

    return {
      summary: `Tailored CV draft for "${job.title}" (${usedAi ? "AI" : "heuristic"}, provider: ${provider.name}${debited ? ", 1 credit debited" : ""}).`,
      data: { text: result.text, mode: usedAi ? "ai" : "heuristic" },
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

    const { provider, usedAi, debited } = await resolveProvider("ai_cover_letter", "ai_cover", String(input.job_id));
    const result = await provider.coverLetter(buildContext(job, cv.text));

    return {
      summary: `Cover letter draft for "${job.title}" (${usedAi ? "AI" : "heuristic"}, provider: ${provider.name}${debited ? ", 1 credit debited" : ""}).`,
      data: { text: result.text, mode: usedAi ? "ai" : "heuristic" },
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

    const { provider, usedAi, debited } = await resolveProvider("ai_answer", "ai_answer", String(input.job_id ?? ""));
    const result = await provider.draftAnswer(buildContext(ctxJob, cvText, input.question));

    return {
      summary: `Drafted answer (${usedAi ? "AI" : "heuristic"}, provider: ${provider.name}${debited ? ", 1 credit debited" : ""}).`,
      data: { question: input.question, text: result.text, mode: usedAi ? "ai" : "heuristic" },
      notes: result.notes,
    };
  },
};