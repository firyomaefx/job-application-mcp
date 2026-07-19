import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile } from "../store/profile.js";
import { getCv, getJob, saveApplication } from "../store/applications.js";
import { extractKeywords, scoreMatch } from "../lib/scoring.js";

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
  run: (input) => {
    const job = getJob(input.job_id);
    if (!job) return { summary: `Job ${input.job_id} not found.` };
    const cv = getCv(input.cv_id);
    if (!cv) return { summary: `CV ${input.cv_id} not found.` };

    // Combine the profile's curated skills with skills detected in the CV text.
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
    "Produce basic, local CV-tailoring suggestions: which skills to surface, which to add, " +
    "and where the CV undersells the job. Free core (heuristic). Pro adds AI rewriting.",
  inputSchema: tailorCvSchema,
  run: (input) => {
    const job = getJob(input.job_id);
    if (!job) return { summary: `Job ${input.job_id} not found.` };
    const cv = getCv(input.cv_id);
    if (!cv) return { summary: `CV ${input.cv_id} not found.` };

    const cvSkills = new Set(extractKeywords(cv.text, 40).map((s) => s.toLowerCase()));
    const surface: string[] = [];
    const missing: string[] = [];
    for (const kw of job.keywords) {
      if (cvSkills.has(kw.toLowerCase())) surface.push(kw);
      else missing.push(kw);
    }

    const profile = getDefaultProfile();
    const profileHas = new Set(profile.skills.map((s) => s.toLowerCase()));
    const mentionable = missing.filter((m) => profileHas.has(m.toLowerCase()));

    const suggestions: string[] = [];
    if (surface.length > 0) {
      suggestions.push(
        `Move these matched skills higher in the CV: ${surface.slice(0, 10).join(", ")}.`
      );
    }
    if (mentionable.length > 0) {
      suggestions.push(
        `You have these in your profile but not this CV — add them: ${mentionable.slice(0, 10).join(", ")}.`
      );
    }
    if (missing.length > mentionable.length) {
      const gaps = missing.filter((m) => !mentionable.includes(m));
      suggestions.push(
        `Genuine gaps to address (or de-emphasize): ${gaps.slice(0, 8).join(", ")}.`
      );
    }

    return {
      summary: `${suggestions.length} tailoring suggestion(s) for "${job.title}".`,
      data: { surface, missing, mentionable, suggestions },
      notes: [
        "Free core gives structural suggestions only. AI rewriting is a Pro feature.",
      ],
    };
  },
};

const draftAnswerSchema = z.object({
  question: z.string().min(5),
  cv_id: z.number().int().optional(),
  profile_summary: z.string().optional(),
});

export const draftAnswerTool: ToolDef<typeof draftAnswerSchema> = {
  name: "draft_answer",
  description:
    "Draft a basic screening-answer starter from the candidate profile + CV. Free core: a " +
    "structured template the user must review and rewrite. Not a finished answer.",
  inputSchema: draftAnswerSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    let cvText = "";
    if (input.cv_id) {
      const cv = getCv(input.cv_id);
      if (cv) cvText = cv.text;
    }
    const skills = profile.skills.length > 0 ? profile.skills : extractKeywords(cvText, 10);

    const draft =
      `[Draft — review and rewrite before use]\n\n` +
      `Question: ${input.question}\n\n` +
      `Suggested opening: I'm ${profile.full_name}${
        profile.headline ? `, ${profile.headline}` : ""
      }. ` +
      `My background centers on ${skills.slice(0, 5).join(", ")}.\n\n` +
      `Talking points to develop:\n` +
      `- Directly answer the question with one concrete example.\n` +
      `- Tie back to: ${skills.slice(0, 3).join(", ")}.\n` +
      `- Quantify an outcome (number, %, timeline).\n` +
      `- Close with why this role fits.\n\n` +
      `Relevant material from CV: ${cvText.slice(0, 500) || "(none provided)"}`;

    return {
      summary: "Drafted a starter answer for review.",
      data: { question: input.question, draft },
      notes: [
        "This is a template, not a finished answer. Verify every claim against your CV.",
        "AI-drafted, polished answers are a Pro feature.",
      ],
    };
  },
};