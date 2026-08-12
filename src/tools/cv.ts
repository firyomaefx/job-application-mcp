import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile, listCvs } from "../store/profile.js";
import { saveCv, getCv, updateCv, getCvHistory, getJob, listApplications } from "../store/applications.js";
import { parseCvFile, parseCvText } from "../cv/parser.js";
import { extractKeywords } from "../lib/scoring.js";
import { cvToMarkdown } from "../export/markdown.js";

const parseCvSchema = z.object({
  file_path: z.string().optional(),
  text: z.string().optional(),
  label: z.string().optional(),
});

export const parseCvTool: ToolDef<typeof parseCvSchema> = {
  name: "parse_cv",
  description:
    "Parse a CV from a local file path (PDF/DOCX/TXT) or pasted text and store it locally. " +
    "Nothing is uploaded. Returns the extracted text length and detected skills.",
  inputSchema: parseCvSchema,
  run: async (input) => {
    if (!input.file_path && input.text === undefined) {
      return {
        summary: "Provide either file_path or text.",
        notes: ["No input given — nothing stored."],
      };
    }

    const parsed = input.file_path
      ? await parseCvFile(input.file_path)
      : parseCvText(input.text ?? "");

    const profile = getDefaultProfile();
    const label = input.label ?? (input.file_path ? "imported-cv" : "pasted-cv");
    const cv = saveCv(profile.id, label, parsed.text, input.file_path ?? null);

    const skills = extractKeywords(parsed.text, 25);

    return {
      summary: `Stored CV "${cv.label}" (id ${cv.id}, ${parsed.format}, ${parsed.charCount} chars).`,
      data: {
        cv_id: cv.id,
        format: parsed.format,
        char_count: parsed.charCount,
        detected_skills: skills,
        preview: parsed.text.slice(0, 280),
      },
      notes: [
        "Detected skills are a first guess — confirm with update_profile.skills for accurate matching.",
        "Use update_cv to revise it later — the previous text is kept as a version (list_cv_versions).",
      ],
    };
  },
};

const listCvsSchema = z.object({
  include_history: z.boolean().optional().default(false),
});

export const listCvsTool: ToolDef<typeof listCvsSchema> = {
  name: "list_cvs",
  description:
    "List stored CVs (active versions only by default). Pass include_history=true to see every version.",
  inputSchema: listCvsSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const rows = listCvs(profile.id, { includeInactive: input.include_history });
    return {
      summary: `${rows.length} CV(s)${input.include_history ? " (all versions)" : " (active)"} on file.`,
      data: rows,
      notes: input.include_history
        ? ["Inactive rows are older versions kept for history; the active one is the latest edit."]
        : ["Pass include_history=true to see previous versions of a CV."],
    };
  },
};

const updateCvSchema = z.object({
  cv_id: z.number().int(),
  label: z.string().optional(),
  text: z.string().optional(),
});

export const updateCvTool: ToolDef<typeof updateCvSchema> = {
  name: "update_cv",
  description:
    "Revise a stored CV as a NEW version (the previous text is preserved, not overwritten). " +
    "Provide a new label, new text, or both. The new version becomes the active one; the old " +
    "version is kept for history (list_cv_versions). Nothing is uploaded or deleted.",
  inputSchema: updateCvSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    if (input.label === undefined && input.text === undefined) {
      return { summary: "Provide label and/or text to revise the CV." };
    }
    const updated = updateCv(profile.id, input.cv_id, { label: input.label, text: input.text });
    if (!updated) return { summary: `CV ${input.cv_id} not found.` };
    return {
      summary: `Revised CV "${updated.label}" → new version id ${updated.id} (previous kept as history).`,
      data: {
        cv_id: updated.id,
        label: updated.label,
        parent_cv_id: updated.parent_cv_id,
        char_count: updated.text.length,
        updated_at: updated.updated_at,
      },
      notes: ["The previous CV version is preserved; list_cv_versions shows the full chain."],
    };
  },
};

const listCvVersionsSchema = z.object({
  cv_id: z.number().int(),
});

export const listCvVersionsTool: ToolDef<typeof listCvVersionsSchema> = {
  name: "list_cv_versions",
  description:
    "List every version of a CV (oldest → newest), resolved from any cv in its version chain. " +
    "Marks which version is currently active.",
  inputSchema: listCvVersionsSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const chain = getCvHistory(profile.id, input.cv_id);
    if (chain.length === 0) return { summary: `CV ${input.cv_id} not found.` };
    return {
      summary: `${chain.length} version(s) for this CV.`,
      data: chain.map((c) => ({
        id: c.id,
        label: c.label,
        is_active: c.is_active === 1,
        parent_cv_id: c.parent_cv_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
        char_count: c.text.length,
      })),
    };
  },
};

const exportCvMarkdownSchema = z.object({
  cv_id: z.number().int(),
  job_id: z.number().int().optional(),
  include_cover_letter: z.boolean().optional().default(true),
});

export const exportCvMarkdownTool: ToolDef<typeof exportCvMarkdownSchema> = {
  name: "export_cv_markdown",
  description:
    "Render a stored CV (plus optional cover letter tailored to a job) to Markdown text for " +
    "export. Pure text — nothing is uploaded. The desktop app can convert this to PDF via " +
    "print-to-PDF; for a headless/CLI user the Markdown itself is a portable export.",
  inputSchema: exportCvMarkdownSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const cv = getCv(input.cv_id);
    if (!cv || cv.profile_id !== profile.id) return { summary: `CV ${input.cv_id} not found.` };
    let job = null;
    let coverLetter: string | null = null;
    if (input.job_id) {
      job = getJob(input.job_id);
      const apps = listApplications(profile.id);
      const app = apps.find((a: { job_id: number; cover_letter: string | null }) => a.job_id === input.job_id);
      if (app) coverLetter = app.cover_letter ?? null;
    }
    const md = cvToMarkdown({
      profile,
      cv,
      job,
      coverLetter: input.include_cover_letter ? coverLetter : null,
    });
    return {
      summary: `Exported CV "${cv.label}" (${md.length} chars Markdown).`,
      data: { markdown: md, char_count: md.length },
      notes: ["Use the desktop app's Export → PDF for a formatted PDF, or save this Markdown directly."],
    };
  },
};