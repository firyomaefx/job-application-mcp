import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile } from "../store/profile.js";
import { getJob, saveJob } from "../store/applications.js";
import { extractKeywords } from "../lib/scoring.js";

const analyzeJobSchema = z.object({
  description: z.string().min(20),
  title: z.string().optional(),
  company: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  store: z.boolean().optional().default(true),
});

export const analyzeJobTool: ToolDef<typeof analyzeJobSchema> = {
  name: "analyze_job",
  description:
    "Analyze a job description (pasted text). Extracts key skills/keywords and a short summary. " +
    "By default also imports/stores the job. For LinkedIn/Indeed, paste the description text — " +
    "do not attempt automated scraping.",
  inputSchema: analyzeJobSchema,
  run: (input) => {
    const keywords = extractKeywords(input.description, 30);
    const title = input.title ?? guessTitle(input.description);

    let jobId: number | null = null;
    if (input.store) {
      const profile = getDefaultProfile();
      const job = saveJob(profile.id, {
        title,
        company: input.company ?? null,
        url: input.url ?? null,
        description: input.description,
        keywords,
      });
      jobId = job.id;
    }

    return {
      summary: `Analyzed "${title}" — ${keywords.length} key skills detected${
        jobId ? ` (stored as job id ${jobId})` : " (not stored)"
      }.`,
      data: {
        job_id: jobId,
        title,
        company: input.company ?? null,
        keywords,
        summary: buildSummary(input.description),
      },
      notes: [
        "Keywords are heuristically extracted. Confirm against the original posting before matching.",
      ],
    };
  },
};

const getJobSchema = z.object({ job_id: z.number().int() });

export const getJobTool: ToolDef<typeof getJobSchema> = {
  name: "get_job",
  description: "Return a stored job by id, including its extracted keywords.",
  inputSchema: getJobSchema,
  run: (input) => {
    const job = getJob(input.job_id);
    if (!job) return { summary: `Job ${input.job_id} not found.` };
    return {
      summary: `Job ${job.id}: ${job.title}${job.company ? " @ " + job.company : ""}.`,
      data: job,
    };
  },
};

function guessTitle(description: string): string {
  const firstLine = description.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (firstLine && firstLine.length <= 80) return firstLine;
  return "Untitled role";
}

function buildSummary(description: string): string {
  const sentences = description
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);
  return sentences.slice(0, 2).join(" ").slice(0, 400);
}