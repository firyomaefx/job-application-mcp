import { z } from "zod";
import type { ToolDef } from "./types.js";
import { requireAutoApplyEnabled, isAutoApplyEnabled } from "../apply/config.js";
import { classifyApplyUrl } from "../apply/platform.js";
import { getAdapterHints } from "../apply/adapters/index.js";
import { buildCandidateValues } from "../apply/candidate-values.js";
import { classifyFieldsForApply, mappingBlocksAutoSubmit } from "../apply/mapping.js";
import { runAutoApplySafetyChecks } from "../apply/safety.js";
import { requestApproval, validateForSubmission } from "../submission/approval.js";
import { getDefaultProfile } from "../store/profile.js";
import {
  getApplyDefaults,
  setApplyDefaults,
  DEFAULT_ANSWER_KEYS,
} from "../store/apply-defaults.js";
import {
  enqueueApply,
  listApplyQueue,
  getQueueItem,
  cancelQueueItem,
  updateQueueItem,
} from "../store/apply-queue.js";
import {
  getApplication,
  getJob,
  getCv,
  saveJob,
  saveApplication,
  updateApplicationStatus,
  updateApplication,
} from "../store/applications.js";
import { listCvs } from "../store/profile.js";
import { scoreMatch, extractKeywords } from "../lib/scoring.js";

const fieldSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
});

// ── defaults ────────────────────────────────────────────────────

const setApplyDefaultsSchema = z.object({
  answers: z.record(z.string(), z.string()).optional(),
  min_match_score: z.number().int().min(0).max(100).optional(),
  max_applies_per_day: z.number().int().min(1).max(100).optional(),
  auto_enqueue_on_detect: z.boolean().optional(),
});

export const setApplyDefaultsTool: ToolDef<typeof setApplyDefaultsSchema> = {
  name: "set_apply_defaults",
  description:
    "Store pre-approved answers for automated applications (work authorization, salary, etc.) " +
    "and safety caps. Used when JOB_MCP_AUTO_APPLY=1. Does not submit anything by itself.",
  inputSchema: setApplyDefaultsSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const defaults = setApplyDefaults(profile.id, input);
    return {
      summary: `Apply defaults updated (${Object.keys(defaults.answers).length} answer(s), cap ${defaults.max_applies_per_day}/day).`,
      data: defaults,
      notes: [`Known answer keys: ${DEFAULT_ANSWER_KEYS.join(", ")}.`],
    };
  },
};

const getApplyDefaultsSchema = z.object({});

export const getApplyDefaultsTool: ToolDef<typeof getApplyDefaultsSchema> = {
  name: "get_apply_defaults",
  description: "Return stored apply-default answers and daily caps for auto-apply.",
  inputSchema: getApplyDefaultsSchema,
  run: () => {
    const profile = getDefaultProfile();
    const defaults = getApplyDefaults(profile.id);
    return {
      summary: `Apply defaults (cap ${defaults.max_applies_per_day}/day, min score ${defaults.min_match_score}).`,
      data: { ...defaults, auto_apply_enabled: isAutoApplyEnabled() },
    };
  },
};

// ── queue ───────────────────────────────────────────────────────

const enqueueSchema = z.object({
  url: z.string().url(),
  job_id: z.number().int().optional(),
});

export const enqueueApplyTool: ToolDef<typeof enqueueSchema> = {
  name: "enqueue_apply",
  description:
    "Add an employer ATS apply URL to the local auto-apply queue. Blocks LinkedIn/Indeed apply URLs. " +
    "Does not open a browser.",
  inputSchema: enqueueSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    const platform = classifyApplyUrl(input.url);
    if (!platform.allowed) {
      return { summary: `Cannot enqueue: ${platform.reason}.` };
    }
    const profile = getDefaultProfile();
    if (input.job_id) {
      const job = getJob(input.job_id);
      if (!job) return { summary: `Job ${input.job_id} not found.` };
    }
    const item = enqueueApply(profile.id, input.url, input.job_id ?? null);
    updateQueueItem(item.id, { adapter_id: platform.adapter_id });
    return {
      summary: `Queued apply #${item.id} (${platform.adapter_id}) for ${input.url}.`,
      data: getQueueItem(item.id),
      notes: ["Call prepare_application then run_auto_apply when ready."],
    };
  },
};

const listQueueSchema = z.object({
  status: z
    .enum(["pending", "preparing", "ready", "applying", "paused", "done", "failed", "cancelled"])
    .optional(),
});

export const listApplyQueueTool: ToolDef<typeof listQueueSchema> = {
  name: "list_apply_queue",
  description: "List local auto-apply queue items.",
  inputSchema: listQueueSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    const profile = getDefaultProfile();
    const items = listApplyQueue(profile.id, input.status);
    return {
      summary: `${items.length} queue item(s).`,
      data: items,
    };
  },
};

const cancelSchema = z.object({ queue_id: z.number().int() });

export const cancelApplyQueueTool: ToolDef<typeof cancelSchema> = {
  name: "cancel_apply_queue_item",
  description: "Cancel a pending/ready auto-apply queue item.",
  inputSchema: cancelSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    const item = cancelQueueItem(input.queue_id);
    if (!item) return { summary: `Queue item ${input.queue_id} not found.` };
    return { summary: `Queue item ${item.id} is '${item.status}'.`, data: item };
  },
};

// ── prepare ─────────────────────────────────────────────────────

const prepareSchema = z.object({
  queue_id: z.number().int(),
  cv_id: z.number().int().optional(),
});

export const prepareApplicationTool: ToolDef<typeof prepareSchema> = {
  name: "prepare_application",
  description:
    "Prepare a queued job for auto-apply: score CV, create/update draft application, set status ready. " +
    "Requires JOB_MCP_AUTO_APPLY=1.",
  inputSchema: prepareSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    const item = getQueueItem(input.queue_id);
    if (!item) return { summary: `Queue item ${input.queue_id} not found.` };
    if (item.status === "cancelled" || item.status === "done") {
      return { summary: `Queue item ${item.id} is already ${item.status}.` };
    }
    updateQueueItem(item.id, { status: "preparing", error: null });

    const profile = getDefaultProfile();
    const defaults = getApplyDefaults(profile.id);
    let cvId = input.cv_id;
    if (cvId == null) {
      const cvs = listCvs(profile.id) as { id: number }[];
      if (!cvs.length) {
        updateQueueItem(item.id, { status: "failed", error: "no CV on file" });
        return { summary: "No CV found. Parse a CV first." };
      }
      cvId = cvs[cvs.length - 1].id;
    }
    const cv = getCv(cvId);
    if (!cv) {
      updateQueueItem(item.id, { status: "failed", error: "cv not found" });
      return { summary: `CV ${cvId} not found.` };
    }

    let jobId = item.job_id;
    if (jobId == null) {
      updateQueueItem(item.id, {
        status: "paused",
        pause_reason: "missing job_id — import job on this URL first (enqueue_apply with job_id)",
      });
      return {
        summary: "Queue item has no job_id. Import the job, then enqueue with job_id.",
        data: getQueueItem(item.id),
      };
    }
    const job = getJob(jobId);
    if (!job) {
      updateQueueItem(item.id, { status: "failed", error: "job not found" });
      return { summary: `Job ${jobId} not found.` };
    }

    const cvSkills = extractKeywords(cv.text, 30);
    const candidateSkills = Array.from(new Set([...profile.skills, ...cvSkills]));
    const result = scoreMatch(candidateSkills, job.keywords);

    if (result.score < defaults.min_match_score) {
      updateQueueItem(item.id, {
        status: "failed",
        error: `score ${result.score} below min ${defaults.min_match_score}`,
      });
      return {
        summary: `Match ${result.score} below minimum ${defaults.min_match_score}. Not preparing.`,
        data: { score: result.score },
      };
    }

    let app = item.application_id ? getApplication(item.application_id) : null;
    if (app) {
      app = updateApplication(app.id, {
        cv_id: cv.id,
        match_score: result.score,
      })!;
    } else {
      app = saveApplication({
        profile_id: profile.id,
        job_id: job.id,
        cv_id: cv.id,
        match_score: result.score,
        status: "draft",
      });
    }
    updateApplicationStatus(app.id, "ready");
    updateQueueItem(item.id, {
      status: "ready",
      application_id: app.id,
      error: null,
      pause_reason: null,
    });

    return {
      summary: `Ready to apply: application ${app.id}, score ${result.score}/100.`,
      data: { queue_id: item.id, application_id: app.id, score: result.score, url: item.url },
    };
  },
};

// ── run / execute ───────────────────────────────────────────────

const runSchema = z.object({ queue_id: z.number().int() });

export const runAutoApplyTool: ToolDef<typeof runSchema> = {
  name: "run_auto_apply",
  description:
    "Start an auto-apply run for a ready queue item. Returns URL, adapter hints, and application id " +
    "for the browser extension. Does not submit until execute_autofill + extension confirm.",
  inputSchema: runSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    const item = getQueueItem(input.queue_id);
    if (!item) return { summary: `Queue item ${input.queue_id} not found.` };
    if (item.status !== "ready" && item.status !== "paused") {
      return { summary: `Queue item ${item.id} must be 'ready' (currently '${item.status}').` };
    }
    if (!item.application_id) {
      return { summary: "No application_id on queue item. Call prepare_application first." };
    }

    const safety = runAutoApplySafetyChecks(item.url, item.application_id);
    if (!safety.ok) {
      updateQueueItem(item.id, { status: "failed", error: safety.error ?? "safety check failed" });
      return { summary: `Safety check failed: ${safety.error}`, data: { checks: safety.checks } };
    }

    const platform = classifyApplyUrl(item.url);
    if (!platform.allowed) {
      return { summary: platform.reason };
    }
    const hints = getAdapterHints(platform.adapter_id);
    updateQueueItem(item.id, { status: "applying", adapter_id: platform.adapter_id });

    return {
      summary: `Auto-apply run started for queue #${item.id} (${platform.adapter_id}).`,
      data: {
        queue_id: item.id,
        application_id: item.application_id,
        url: item.url,
        adapter: hints,
      },
      notes: [
        "Open the URL in the browser, capture fields, call execute_autofill, then use extension Auto-apply.",
        "On CAPTCHA/login, call pause_for_human.",
      ],
    };
  },
};

const executeSchema = z.object({
  application_id: z.number().int(),
  queue_id: z.number().int().optional(),
  url: z.string().url(),
  form_fields: z.array(fieldSchema),
  issue_approval_token: z.boolean().optional(),
});

export const executeAutofillTool: ToolDef<typeof executeSchema> = {
  name: "execute_autofill",
  description:
    "When JOB_MCP_AUTO_APPLY=1: map fields for DOM autofill (extension may write values). " +
    "Optionally issues an approval token when mapping is safe. Never bypasses CAPTCHA.",
  inputSchema: executeSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    const platform = classifyApplyUrl(input.url);
    if (!platform.allowed) {
      return { summary: platform.reason };
    }
    const app = getApplication(input.application_id);
    if (!app) return { summary: `Application ${input.application_id} not found.` };

    const safety = runAutoApplySafetyChecks(input.url, input.application_id);
    if (!safety.ok) {
      return { summary: `Blocked: ${safety.error}`, data: { checks: safety.checks } };
    }

    const candidateValues = buildCandidateValues(app);
    const mapping = classifyFieldsForApply(input.form_fields, candidateValues);
    const blocked = mappingBlocksAutoSubmit(mapping);

    let approval: ReturnType<typeof requestApproval> | null = null;
    const wantToken = input.issue_approval_token !== false;
    if (wantToken && blocked.length === 0) {
      try {
        approval = requestApproval(
          input.application_id,
          mapping.map((m) => ({
            name: m.field,
            label: m.label,
            mapped_to: m.mapped_to,
            value: m.value,
            requires_user_review: m.requires_user_review,
          })),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          summary: `Autofill mapped but approval blocked: ${msg}`,
          data: { mapping, blocked_fields: blocked },
        };
      }
    }

    const hints = getAdapterHints(platform.adapter_id);
    if (input.queue_id) {
      updateQueueItem(input.queue_id, { status: "applying", adapter_id: platform.adapter_id });
    }

    return {
      summary: `Autofill ready for ${mapping.length} field(s)${approval ? " with approval token" : ""}.`,
      data: {
        application_id: app.id,
        mapping,
        adapter: hints,
        can_auto_submit: Boolean(approval),
        approval,
        blocked_fields: blocked,
      },
      notes: blocked.length
        ? ["Resolve blocked fields or set_apply_defaults before auto-submit."]
        : approval
          ? ["Extension may fill, submit, then confirm_submission with the token."]
          : ["Mapping only — approval token not issued."],
    };
  },
};

// ── reporting / pause ───────────────────────────────────────────

const reportSchema = z.object({
  queue_id: z.number().int(),
  step: z.enum(["filled", "submitted", "failed"]),
  detail: z.string().optional(),
});

export const reportApplyStepTool: ToolDef<typeof reportSchema> = {
  name: "report_apply_step",
  description: "Report browser auto-apply progress for a queue item.",
  inputSchema: reportSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    const item = getQueueItem(input.queue_id);
    if (!item) return { summary: `Queue item ${input.queue_id} not found.` };

    if (input.step === "filled") {
      updateQueueItem(item.id, { status: "applying", error: null });
      return { summary: `Recorded fill step for queue #${item.id}.` };
    }
    if (input.step === "submitted") {
      updateQueueItem(item.id, { status: "done", error: null, pause_reason: null });
      return { summary: `Queue #${item.id} marked done (browser reported submit).` };
    }
    updateQueueItem(item.id, { status: "failed", error: input.detail ?? "apply failed" });
    return { summary: `Queue #${item.id} failed: ${input.detail ?? "unknown"}.` };
  },
};

const pauseSchema = z.object({
  queue_id: z.number().int(),
  reason: z.string().min(1),
});

export const pauseForHumanTool: ToolDef<typeof pauseSchema> = {
  name: "pause_for_human",
  description:
    "Pause auto-apply for CAPTCHA, login, 2FA, or unknown questions. User completes manually, then resumes.",
  inputSchema: pauseSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    const item = updateQueueItem(input.queue_id, {
      status: "paused",
      pause_reason: input.reason,
    });
    if (!item) return { summary: `Queue item ${input.queue_id} not found.` };
    return {
      summary: `Paused queue #${item.id}: ${input.reason}`,
      data: item,
    };
  },
};

const confirmAttemptSchema = z.object({
  application_id: z.number().int(),
  form_fields: z.array(fieldSchema).optional(),
});

/** Validates gate before the extension clicks submit (no token consumption). */
// ── campaign ────────────────────────────────────────────────────

const startCampaignSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
  cv_id: z.number().int().optional(),
  min_match_score: z.number().int().min(0).max(100).optional(),
  max_applies_per_day: z.number().int().min(1).max(100).optional(),
});

function placeholderJobForUrl(url: string) {
  let title = "Role (ATS apply)";
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    if (seg) title = decodeURIComponent(seg).replace(/[-_+]/g, " ").slice(0, 120);
  } catch {
    /* keep default title */
  }
  const description =
    `${title}\n\nApply via employer ATS.\n\nPosting URL: ${url}\n\n` +
    "Replace this stub with the full posting text for better match scores.";
  return {
    title,
    company: null as string | null,
    url,
    description,
    keywords: extractKeywords(description, 24),
  };
}

export const startCampaignTool: ToolDef<typeof startCampaignSchema> = {
  name: "start_campaign",
  description:
    "Enqueue one or more employer ATS apply URLs, prepare applications, and return ready queue ids. " +
    "Creates a stub job record per URL when none exists. Requires JOB_MCP_AUTO_APPLY=1. " +
    "Run the desktop Playwright worker or the extension to process the queue.",
  inputSchema: startCampaignSchema,
  run: async (input) => {
    requireAutoApplyEnabled();
    const profile = getDefaultProfile();

    if (input.min_match_score != null || input.max_applies_per_day != null) {
      setApplyDefaults(profile.id, {
        min_match_score: input.min_match_score,
        max_applies_per_day: input.max_applies_per_day,
      });
    }

    const results: {
      url: string;
      queue_id?: number;
      status: "ready" | "skipped" | "failed";
      reason?: string;
    }[] = [];

    for (const url of input.urls) {
      const platform = classifyApplyUrl(url);
      if (!platform.allowed) {
        results.push({ url, status: "skipped", reason: platform.reason });
        continue;
      }
      const stub = placeholderJobForUrl(url);
      const job = saveJob(profile.id, stub);
      const item = enqueueApply(profile.id, url, job.id);
      updateQueueItem(item.id, { adapter_id: platform.adapter_id });

      const prep = await Promise.resolve(
        prepareApplicationTool.run({ queue_id: item.id, cv_id: input.cv_id }),
      );
      const ready = getQueueItem(item.id);
      if (ready?.status === "ready") {
        results.push({ url, queue_id: item.id, status: "ready" });
      } else {
        results.push({
          url,
          queue_id: item.id,
          status: "failed",
          reason: ready?.error || ready?.pause_reason || prep.summary,
        });
      }
    }

    const readyCount = results.filter((r) => r.status === "ready").length;
    return {
      summary: `Campaign prepared: ${readyCount}/${input.urls.length} queue item(s) ready.`,
      data: { results, ready_count: readyCount },
      notes: [
        "Desktop: Campaign → Start worker (Playwright).",
        "Stub job descriptions score low — paste full postings or use JobSpy import for better matches.",
      ],
    };
  },
};

export const confirmApplyAttemptTool: ToolDef<typeof confirmAttemptSchema> = {
  name: "confirm_apply_attempt",
  description:
    "Re-run submission validation immediately before automated submit click. Requires JOB_MCP_AUTO_APPLY=1.",
  inputSchema: confirmAttemptSchema,
  run: (input) => {
    requireAutoApplyEnabled();
    try {
      const fields = input.form_fields
        ? classifyFieldsForApply(
            input.form_fields,
            buildCandidateValues(getApplication(input.application_id)!),
          ).map((m) => ({
            name: m.field,
            label: m.label,
            mapped_to: m.mapped_to,
            value: m.value,
            requires_user_review: m.requires_user_review,
          }))
        : undefined;
      const checks = validateForSubmission(input.application_id, fields);
      const approval = requestApproval(input.application_id, fields);
      return {
        summary: `Submit attempt approved for application ${input.application_id}.`,
        data: { checks, approval_token: approval.approval_token, expires_at: approval.expires_at },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { summary: `Submit attempt blocked: ${msg}` };
    }
  },
};