import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile } from "../store/profile.js";
import { getJob, saveJob, listInboxJobs, triageJob, listApplications } from "../store/applications.js";
import { extractKeywords } from "../lib/scoring.js";
import { rankJobs, bestMatchScore } from "../lib/inbox.js";

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

// ── Job inbox / ranking (Phase 3) ─────────────────────────────────

const inboxStatusSchema = z.enum(["new", "triaged", "applied", "archived"]);

const listJobInboxSchema = z.object({
  status: inboxStatusSchema.optional(),
  include_archived: z.boolean().optional().default(false),
});

export const listJobInboxTool: ToolDef<typeof listJobInboxSchema> = {
  name: "list_job_inbox",
  description:
    "List jobs in your pipeline inbox, optionally filtered by status (new/triaged/applied/archived). " +
    "Archived jobs are excluded unless include_archived=true.",
  inputSchema: listJobInboxSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    let jobs = listInboxJobs(profile.id, input.status);
    if (!input.include_archived && !input.status) {
      jobs = jobs.filter((j) => j.inbox_status !== "archived");
    }
    return {
      summary: `${jobs.length} job(s) in inbox${input.status ? ` (${input.status})` : ""}.`,
      data: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        inbox_status: j.inbox_status,
        url: j.url,
        created_at: j.created_at,
      })),
    };
  },
};

const rankJobsSchema = z.object({
  include_archived: z.boolean().optional().default(false),
});

export const rankJobsTool: ToolDef<typeof rankJobsSchema> = {
  name: "rank_jobs",
  description:
    "Rank the jobs in your inbox by best match score + recency (highest first). " +
    "A ranked, prioritised view of what to apply to next. Archived jobs are excluded by default.",
  inputSchema: rankJobsSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const jobs = listInboxJobs(profile.id);
    const apps = listApplications(profile.id).map((a) => ({ job_id: a.job_id, match_score: a.match_score }));
    const ranked = rankJobs(
      jobs.map((j) => ({ job: j, match_score: bestMatchScore(j.id, apps) })),
      Date.now(),
      { includeArchived: input.include_archived }
    );
    return {
      summary: `${ranked.length} job(s) ranked.`,
      data: ranked.map((r, i) => ({
        rank_position: i + 1,
        job_id: r.job.id,
        title: r.job.title,
        company: r.job.company,
        inbox_status: r.job.inbox_status,
        match_score: r.match_score,
        rank: r.rank,
      })),
      notes: ["Rank = best application match score + a 30-day recency bonus. Triage with triage_job."],
    };
  },
};

const triageJobSchema = z.object({
  job_id: z.number().int(),
  status: inboxStatusSchema,
});

export const triageJobTool: ToolDef<typeof triageJobSchema> = {
  name: "triage_job",
  description:
    "Set a job's inbox status: 'new' (just imported), 'triaged' (reviewed, plan to apply), " +
    "'applied' (an application exists / you applied), or 'archived' (not pursuing).",
  inputSchema: triageJobSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const job = triageJob(profile.id, input.job_id, input.status);
    if (!job) return { summary: `Job ${input.job_id} not found.` };
    return {
      summary: `Job ${job.id} ("${job.title}") marked '${job.inbox_status}'.`,
      data: { job_id: job.id, inbox_status: job.inbox_status },
    };
  },
};