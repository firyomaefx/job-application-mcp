import type { AnyTool } from "./types.js";
import { getProfileTool, updateProfileTool } from "./profile.js";
import { parseCvTool, listCvsTool } from "./cv.js";
import { analyzeJobTool, getJobTool } from "./job.js";
import { matchCvTool, tailorCvTool, draftAnswerTool } from "./matching.js";
import {
  saveApplicationTool,
  listApplicationsTool,
  updateStatusTool,
  autofillFormTool,
} from "./application.js";

/** All free-core tools, in the order they appear to MCP clients. */
export const tools: AnyTool[] = [
  getProfileTool,
  updateProfileTool,
  parseCvTool,
  listCvsTool,
  analyzeJobTool,
  getJobTool,
  matchCvTool,
  tailorCvTool,
  draftAnswerTool,
  saveApplicationTool,
  listApplicationsTool,
  updateStatusTool,
  autofillFormTool,
];

export const toolByName = new Map(tools.map((t) => [t.name, t]));