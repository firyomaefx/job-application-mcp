// Phase 5: end-to-end MCP workflow against tool handlers + store, using the
// local mock AI (no paid calls, no real browser submission).
//
// Import Job → Score → Select CV → Draft → Autofill preview → Request approval
// → Confirm submission → Record application.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { closeDb, resetDb, openDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import { listApplications, getApplication } from "../src/store/applications.js";
import { toolByName } from "../src/tools/index.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-workflow";
mkdirSync("./data-test-workflow", { recursive: true });

test.after(() => {
  closeDb();
  rmSync("./data-test-workflow", { recursive: true, force: true });
});

async function call(name: string, args: unknown) {
  const t = toolByName.get(name);
  if (!t) throw new Error(`tool ${name} not found`);
  const parsed = t.inputSchema.safeParse(args);
  if (!parsed.success) throw new Error(`bad args for ${name}: ${parsed.error.message}`);
  return t.run(parsed.data) as Promise<{ summary: string; data?: any; notes?: string[] }>;
}

test("Phase 5: full workflow import → score → draft → preview → approve → record", async () => {
  openDb();
  resetDb();
  const p = getDefaultProfile();

  // 1. Import job (analyze_job tool stores keywords + job).
  const jobRes: any = await call("analyze_job", {
    description: "Senior Backend Engineer. Must have Node.js, TypeScript, SQL, AWS. CI/CD a plus.",
    title: "Senior Backend Engineer",
  });
  const jobId = jobRes.data.job_id;
  assert.ok(jobId, "job imported");

  // 2. Select CV — write a CV file under the data dir and parse it (parse_cv stores it).
  const cvDir = resolve("./data-test-workflow", "cvs");
  if (!existsSync(cvDir)) mkdirSync(cvDir, { recursive: true });
  const cvFile = join(cvDir, "jane.txt");
  writeFileSync(cvFile, "Jane Doe\nSkills: Node.js, TypeScript, SQL, AWS\n5 years backend.", "utf8");
  const parseRes: any = await call("parse_cv", { file_path: cvFile });
  assert.ok(parseRes.data.preview.includes("TypeScript"));
  const cvId = parseRes.data.cv_id;
  assert.ok(cvId, "CV stored");

  // 3. Score + create draft application (match_cv with save).
  const matchRes: any = await call("match_cv", { job_id: jobId, cv_id: cvId, save: true });
  const appId = matchRes.data.application_id;
  assert.ok(appId, "draft application created");
  assert.ok(matchRes.data.score >= 0 && matchRes.data.score <= 100);

  // 4. Draft a cover letter (local mock — no paid call).
  const coverRes: any = await call("cover_letter", { job_id: jobId, cv_id: cvId });
  assert.ok(coverRes.data.text.length > 0);
  assert.equal(coverRes.data.mode, "heuristic");

  // 5. Autofill preview (nothing submitted).
  const previewRes: any = await call("autofill_form", {
    application_id: appId,
    form_fields: [
      { name: "name", label: "Full name" },
      { name: "email", label: "Email" },
      { name: "salary", label: "Salary expectation" },
    ],
  });
  const salaryField = previewRes.data.mapping.find((f: any) => f.field === "salary");
  assert.ok(salaryField.sensitive, "salary flagged sensitive");
  assert.equal(salaryField.requires_user_review, true);

  // 6. Request approval — sensitive field is unresolved, so this must block.
  await assert.rejects(
    () => call("request_approval", { application_id: appId, form_fields: previewRes.data.mapping }),
    /unresolved sensitive field/,
  );

  // 7. Resolve the sensitive field (user reviewed + set a value), then approve.
  const resolvedFields = previewRes.data.mapping.map((f: any) => ({
    ...f,
    value: f.value || (f.field === "salary" ? "100000" : f.value),
    requires_user_review: false,
  }));
  const approvalRes: any = await call("request_approval", { application_id: appId, form_fields: resolvedFields });
  const token = approvalRes.data.approval_token;
  assert.ok(token);

  // 8. Confirm submission (records the user-performed submission).
  const confirmRes: any = await call("confirm_submission", {
    application_id: appId,
    approval_token: token,
    confirmation: "CONF-909",
  });
  assert.equal(confirmRes.data.status, "submitted");

  // 9. Recorded application list reflects the submission.
  const apps = listApplications(p.id);
  assert.equal(apps.length, 1);
  assert.equal(getApplication(appId)?.status, "submitted");
});