import type { AnyTool } from "./types.js";
import { getProfileTool, updateProfileTool } from "./profile.js";
import { parseCvTool, listCvsTool } from "./cv.js";
import { analyzeJobTool, getJobTool } from "./job.js";
import { matchCvTool, tailorCvTool, coverLetterTool, draftAnswerTool } from "./matching.js";
import {
  saveApplicationTool,
  listApplicationsTool,
  updateStatusTool,
  autofillFormTool,
} from "./application.js";
import { requestApprovalTool, confirmSubmissionTool } from "./submission.js";
import { analyticsTool, statusTool } from "./analytics.js";
import { backupDataTool, listBackupsTool, restoreDataTool } from "./backup.js";
import { topupCreditsTool, creditsTool, grantMonthlyTool } from "./pro.js";
import {
  createAccountTool,
  addCandidateTool,
  listTeamTool,
  usageReportTool,
} from "./admin.js";

/** All tools, in the order they appear to MCP clients. */
export const tools: AnyTool[] = [
  // profile + cv
  getProfileTool,
  updateProfileTool,
  parseCvTool,
  listCvsTool,
  // jobs + matching + prep
  analyzeJobTool,
  getJobTool,
  matchCvTool,
  tailorCvTool,
  coverLetterTool,
  draftAnswerTool,
  // applications + forms
  saveApplicationTool,
  listApplicationsTool,
  updateStatusTool,
  autofillFormTool,
  requestApprovalTool,
  confirmSubmissionTool,
  // analytics + status
  analyticsTool,
  statusTool,
  // backup / restore (local)
  backupDataTool,
  listBackupsTool,
  restoreDataTool,
  // credits / pro
  creditsTool,
  topupCreditsTool,
  grantMonthlyTool,
  // business / admin
  createAccountTool,
  addCandidateTool,
  listTeamTool,
  usageReportTool,
];

export const toolByName = new Map(tools.map((t) => [t.name, t]));