import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile, listCvs } from "../store/profile.js";
import { saveCv } from "../store/applications.js";
import { parseCvFile, parseCvText } from "../cv/parser.js";
import { extractKeywords } from "../lib/scoring.js";

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
      ],
    };
  },
};

const listCvsSchema = z.object({});

export const listCvsTool: ToolDef<typeof listCvsSchema> = {
  name: "list_cvs",
  description: "List all stored CVs for the candidate.",
  inputSchema: listCvsSchema,
  run: () => {
    const profile = getDefaultProfile();
    const rows = listCvs(profile.id) as { id: number; label: string; source_path: string | null; created_at: string }[];
    return {
      summary: `${rows.length} CV(s) on file.`,
      data: rows,
    };
  },
};