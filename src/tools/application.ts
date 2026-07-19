import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile } from "../store/profile.js";
import {
  getApplication,
  getJob,
  listApplications,
  saveApplication,
  updateApplicationStatus,
} from "../store/applications.js";
import type { ApplicationStatus } from "../lib/types.js";

const saveApplicationSchema = z.object({
  job_id: z.number().int(),
  cv_id: z.number().int().nullable().optional(),
  match_score: z.number().int().min(0).max(100).nullable().optional(),
  tailored_cv_text: z.string().nullable().optional(),
  cover_letter: z.string().nullable().optional(),
  answers: z.record(z.string(), z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export const saveApplicationTool: ToolDef<typeof saveApplicationSchema> = {
  name: "save_application",
  description:
    "Create or update a draft application for a job. Stores tailored CV text, cover letter, " +
    "and screening answers locally. This is a draft — it does NOT submit anything.",
  inputSchema: saveApplicationSchema,
  run: (input) => {
    const job = getJob(input.job_id);
    if (!job) return { summary: `Job ${input.job_id} not found.` };
    const profile = getDefaultProfile();
    const app = saveApplication({
      profile_id: profile.id,
      job_id: input.job_id,
      cv_id: input.cv_id ?? null,
      match_score: input.match_score ?? null,
      tailored_cv_text: input.tailored_cv_text ?? null,
      cover_letter: input.cover_letter ?? null,
      answers: input.answers ?? {},
      notes: input.notes ?? null,
      status: "draft",
    });
    return {
      summary: `Saved draft application ${app.id} for "${job.title}".`,
      data: app,
      notes: [
        "Draft only. Use autofill_form to preview fields, then submit manually on the employer site.",
        "Call update_application_status with 'submitted' after you submit on the site.",
      ],
    };
  },
};

const listApplicationsSchema = z.object({
  status: z
    .enum(["draft", "ready", "submitted", "interview", "offer", "rejected", "closed"])
    .optional(),
});

export const listApplicationsTool: ToolDef<typeof listApplicationsSchema> = {
  name: "list_applications",
  description: "List local application records, optionally filtered by status.",
  inputSchema: listApplicationsSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    let apps = listApplications(profile.id);
    if (input.status) apps = apps.filter((a) => a.status === input.status);
    return {
      summary: `${apps.length} application(s)${input.status ? ` with status '${input.status}'` : ""}.`,
      data: apps.map((a) => ({
        id: a.id,
        job_id: a.job_id,
        status: a.status,
        match_score: a.match_score,
        submitted_at: a.submitted_at,
        updated_at: a.updated_at,
      })),
    };
  },
};

const updateStatusSchema = z.object({
  application_id: z.number().int(),
  status: z.enum(["draft", "ready", "submitted", "interview", "offer", "rejected", "closed"]),
  notes: z.string().nullable().optional(),
});

export const updateStatusTool: ToolDef<typeof updateStatusSchema> = {
  name: "update_application_status",
  description:
    "Update an application's status (e.g. mark 'submitted' after you submit on the employer site, " +
    "or 'interview' / 'offer' / 'rejected' as you hear back).",
  inputSchema: updateStatusSchema,
  run: (input) => {
    const app = updateApplicationStatus(input.application_id, input.status as ApplicationStatus, input.notes ?? undefined);
    if (!app) return { summary: `Application ${input.application_id} not found.` };
    return {
      summary: `Application ${app.id} is now '${app.status}'.`,
      data: app,
    };
  },
};

const autofillFormSchema = z.object({
  application_id: z.number().int(),
  form_fields: z
    .array(
      z.object({
        name: z.string(),
        label: z.string().optional(),
        type: z.string().optional(),
      })
    )
    .optional(),
});

export const autofillFormTool: ToolDef<typeof autofillFormSchema> = {
  name: "autofill_form",
  description:
    "Map candidate profile + application data onto a list of form fields and return a PREVIEW. " +
    "This does NOT submit and does NOT touch the browser. The user reviews and submits manually. " +
    "Do not use to automate LinkedIn or Indeed.",
  inputSchema: autofillFormSchema,
  run: (input) => {
    const app = getApplication(input.application_id);
    if (!app) return { summary: `Application ${input.application_id} not found.` };
    const profile = getDefaultProfile();
    const job = getJob(app.job_id);

    const candidateValues: Record<string, string> = {
      full_name: profile.full_name,
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      location: profile.location ?? "",
      headline: profile.headline ?? "",
      cover_letter: app.cover_letter ?? "",
    };

    const fields = input.form_fields ?? defaultFormFields();
    const mapping = fields.map((f) => {
      const key = guessKey(f);
      const value = candidateValues[key] ?? "";
      return {
        field: f.name,
        label: f.label ?? f.name,
        mapped_to: key,
        value,
        confidence: value ? "high" : "none",
        requires_user_review: !value || isSensitive(f),
      };
    });

    return {
      summary: `Previewed autofill for ${mapping.length} field(s) — application ${app.id}${
        job ? ` (${job.title})` : ""
      }. Nothing was submitted.`,
      data: { application_id: app.id, mapping },
      notes: [
        "Review every field, especially sensitive ones (legal questions, salary, work authorization).",
        "Submit manually on the employer's site, then call update_application_status with 'submitted'.",
      ],
    };
  },
};

function defaultFormFields() {
  return [
    { name: "name", label: "Full name" },
    { name: "email", label: "Email" },
    { name: "phone", label: "Phone" },
    { name: "location", label: "Location" },
    { name: "cover_letter", label: "Cover letter" },
  ];
}

function guessKey(f: { name: string; label?: string }): string {
  const s = `${f.name} ${f.label ?? ""}`.toLowerCase();
  if (s.includes("cover")) return "cover_letter";
  if (s.includes("mail")) return "email";
  if (s.includes("phone") || s.includes("mobile") || s.includes("tel")) return "phone";
  if (s.includes("location") || s.includes("city") || s.includes("address")) return "location";
  if (s.includes("title") || s.includes("headline")) return "headline";
  if (s.includes("name")) return "full_name";
  return "";
}

function isSensitive(f: { name: string; label?: string }): boolean {
  const s = `${f.name} ${f.label ?? ""}`.toLowerCase();
  return (
    s.includes("salary") ||
    s.includes("salary") ||
    s.includes("authorized") ||
    s.includes("visa") ||
    s.includes("gender") ||
    s.includes("race") ||
    s.includes("disability") ||
    s.includes("consent") ||
    s.includes("agree")
  );
}