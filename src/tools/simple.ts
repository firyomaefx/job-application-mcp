import { z } from "zod";
import { checkThisJob, saveMyCv } from "../simple.js";
import type { ToolDef } from "./types.js";

const saveMyCvSchema = z.object({
  text: z.string(),
});

export const saveMyCvTool: ToolDef<typeof saveMyCvSchema> = {
  name: "save_my_cv",
  description:
    "Show the returned text as-is after saving the pasted CV, and do not add employers, dates, or numbers that are not in it.",
  inputSchema: saveMyCvSchema,
  run: (input) => ({ summary: saveMyCv(input.text).say }),
};

const checkThisJobSchema = z.object({
  description: z.string(),
});

export const checkThisJobTool: ToolDef<typeof checkThisJobSchema> = {
  name: "check_this_job",
  description:
    "Show the returned text as-is after scoring the pasted job, and do not add employers, dates, or numbers that are not in it.",
  inputSchema: checkThisJobSchema,
  run: (input) => ({ summary: checkThisJob({ description: input.description }).say }),
};

/** Default chat surface: two paste actions, nothing else. */
export const simpleTools = [saveMyCvTool, checkThisJobTool];
