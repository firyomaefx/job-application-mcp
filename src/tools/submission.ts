// Approval-gated submission recording tools (N5).
//
// These tools RECORD a user-performed submission; they never submit a form to
// an employer site. The flow is: request_approval (run validation gate, issue a
// short-lived single-use token) → user submits manually on the site →
// confirm_submission (consume the token, mark the application submitted, store
// confirmation). A submission cannot be recorded without a valid, unused,
// unexpired token issued against a fully validated application.

import { z } from "zod";
import type { ToolDef } from "./types.js";
import { requestApproval, confirmSubmission, type FormFieldPreview } from "../submission/approval.js";

const formFieldSchema = z
  .object({
    name: z.string().optional(),
    field: z.string().optional(), // alias used by autofill_form's mapping output
    label: z.string().optional(),
    mapped_to: z.string().optional(),
    value: z.string().optional(),
    requires_user_review: z.boolean().optional(),
  })
  .refine((f) => f.name || f.field, "name or field is required");

const requestApprovalSchema = z.object({
  application_id: z.number().int(),
  form_fields: z.array(formFieldSchema).optional(),
});

/** Normalise the autofill_form mapping shape ({field}) to the approval shape ({name}). */
function normaliseFields(fields?: { name?: string; field?: string; label?: string; mapped_to?: string; value?: string; requires_user_review?: boolean }[]): FormFieldPreview[] | undefined {
  if (!fields) return undefined;
  return fields.map((f) => ({
    name: f.name ?? f.field ?? "",
    label: f.label,
    mapped_to: f.mapped_to,
    value: f.value,
    requires_user_review: f.requires_user_review,
  }));
}

export const requestApprovalTool: ToolDef<typeof requestApprovalSchema> = {
  name: "request_approval",
  description:
    "Validate an application for submission and issue a short-lived (10 min), single-use approval token. " +
    "Checks: valid application, linked job, approved CV attached, not already submitted, no duplicate submission " +
    "for the same job, and (if form_fields from autofill_form are supplied) no unresolved sensitive fields. " +
    "Accepts the autofill_form mapping output directly (field or name). This does NOT submit anything. " +
    "The user submits manually on the employer site, then call confirm_submission.",
  inputSchema: requestApprovalSchema,
  run: (input) => {
    const result = requestApproval(input.application_id, normaliseFields(input.form_fields));
    return {
      summary: `Approval token issued for application ${input.application_id} (expires ${result.expires_at}).`,
      data: result,
      notes: [
        "Submit manually on the employer's site, then call confirm_submission with this token.",
        "The token is single-use and expires in 10 minutes.",
        "Nothing was submitted to any site.",
      ],
    };
  },
};

const confirmSubmissionSchema = z.object({
  application_id: z.number().int(),
  approval_token: z.string().min(16),
  confirmation: z.string().max(500).optional(),
});

export const confirmSubmissionTool: ToolDef<typeof confirmSubmissionSchema> = {
  name: "confirm_submission",
  description:
    "Record a submission after the user has manually submitted on the employer site. Consumes the single-use " +
    "approval token from request_approval, re-runs the validation gate, and marks the application 'submitted' with " +
    "an optional confirmation note (e.g. confirmation number). Does NOT submit anything to a browser. " +
    "Rejects expired, reused, or mismatched tokens.",
  inputSchema: confirmSubmissionSchema,
  run: (input) => {
    const app = confirmSubmission(input.application_id, input.approval_token, input.confirmation);
    return {
      summary: `Application ${app.id} recorded as submitted.`,
      data: app,
      notes: ["Submission recorded locally. The form was submitted by you on the employer's site, not by this tool."],
    };
  },
};