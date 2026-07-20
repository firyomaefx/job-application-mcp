import type { AnyTool } from "./types.js";
import { getProfileTool, updateProfileTool } from "./profile.js";
import { parseCvTool, listCvsTool, updateCvTool, listCvVersionsTool, exportCvMarkdownTool } from "./cv.js";
import { analyzeJobTool, getJobTool, listJobInboxTool, rankJobsTool, triageJobTool } from "./job.js";
import { matchCvTool, tailorCvTool, coverLetterTool, draftAnswerTool } from "./matching.js";
import {
  saveApplicationTool,
  listApplicationsTool,
  updateApplicationTool,
  updateStatusTool,
  autofillFormTool,
} from "./application.js";
import {
  addReminderTool,
  listRemindersTool,
  dueRemindersTool,
  completeReminderTool,
  deleteReminderTool,
} from "./reminders.js";
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
  updateCvTool,
  listCvVersionsTool,
  exportCvMarkdownTool,
  // jobs + matching + prep
  analyzeJobTool,
  getJobTool,
  listJobInboxTool,
  rankJobsTool,
  triageJobTool,
  matchCvTool,
  tailorCvTool,
  coverLetterTool,
  draftAnswerTool,
  // applications + forms
  saveApplicationTool,
  listApplicationsTool,
  updateApplicationTool,
  updateStatusTool,
  autofillFormTool,
  requestApprovalTool,
  confirmSubmissionTool,
  // pipeline: reminders (Phase 3)
  addReminderTool,
  listRemindersTool,
  dueRemindersTool,
  completeReminderTool,
  deleteReminderTool,
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