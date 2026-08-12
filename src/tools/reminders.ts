import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile } from "../store/profile.js";
import {
  addReminder,
  listReminders,
  dueReminders,
  completeReminder,
  deleteReminder,
} from "../store/reminders.js";

const addReminderSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(["follow_up", "interview", "custom"]).optional().default("custom"),
  due_at: z.string().min(1), // ISO date or datetime
  application_id: z.number().int().nullable().optional(),
  job_id: z.number().int().nullable().optional(),
});

export const addReminderTool: ToolDef<typeof addReminderSchema> = {
  name: "add_reminder",
  description:
    "Schedule a local follow-up reminder (e.g. follow up on an application, prep for an interview). " +
    "Stored locally; nothing is uploaded. Use ISO dates (e.g. 2026-07-25 or 2026-07-25T09:00:00).",
  inputSchema: addReminderSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const r = addReminder({
      profile_id: profile.id,
      application_id: input.application_id ?? null,
      job_id: input.job_id ?? null,
      kind: input.kind,
      title: input.title,
      due_at: input.due_at,
    });
    return {
      summary: `Reminder "${r.title}" due ${r.due_at} (id ${r.id}).`,
      data: { id: r.id, title: r.title, due_at: r.due_at, kind: r.kind },
      notes: ["Reminders are local-only. The desktop app surfaces due ones on launch."],
    };
  },
};

const listRemindersSchema = z.object({
  include_done: z.boolean().optional().default(false),
});

export const listRemindersTool: ToolDef<typeof listRemindersSchema> = {
  name: "list_reminders",
  description: "List your open reminders (due/overdue first). Pass include_done=true to see completed ones.",
  inputSchema: listRemindersSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const rows = listReminders(profile.id, { includeDone: input.include_done });
    return {
      summary: `${rows.length} reminder(s)${input.include_done ? "" : " open"}.`,
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        due_at: r.due_at,
        done: r.done === 1,
        application_id: r.application_id,
        job_id: r.job_id,
      })),
    };
  },
};

const dueRemindersSchema = z.object({});

export const dueRemindersTool: ToolDef<typeof dueRemindersSchema> = {
  name: "due_reminders",
  description: "List reminders that are due or overdue (due_at on or before now).",
  inputSchema: dueRemindersSchema,
  run: () => {
    const profile = getDefaultProfile();
    const rows = dueReminders(profile.id, new Date().toISOString());
    return {
      summary: `${rows.length} reminder(s) due/overdue.`,
      data: rows.map((r) => ({ id: r.id, title: r.title, due_at: r.due_at, kind: r.kind })),
    };
  },
};

const completeReminderSchema = z.object({ reminder_id: z.number().int() });

export const completeReminderTool: ToolDef<typeof completeReminderSchema> = {
  name: "complete_reminder",
  description: "Mark a reminder done.",
  inputSchema: completeReminderSchema,
  run: (input) => {
    const r = completeReminder(input.reminder_id);
    if (!r) return { summary: `Reminder ${input.reminder_id} not found.` };
    return { summary: `Reminder "${r.title}" marked done.`, data: { id: r.id, done: true } };
  },
};

const deleteReminderSchema = z.object({ reminder_id: z.number().int() });

export const deleteReminderTool: ToolDef<typeof deleteReminderSchema> = {
  name: "delete_reminder",
  description: "Permanently delete a reminder.",
  inputSchema: deleteReminderSchema,
  run: (input) => {
    const ok = deleteReminder(input.reminder_id);
    return ok
      ? { summary: `Reminder ${input.reminder_id} deleted.` }
      : { summary: `Reminder ${input.reminder_id} not found.` };
  },
};