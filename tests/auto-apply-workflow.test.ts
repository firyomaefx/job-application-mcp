import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { closeDb, openDb, resetDb } from "../src/store/db.js";
import { getDefaultProfile } from "../src/store/profile.js";
import { toolByName } from "../src/tools/index.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-auto-apply";
process.env.JOB_MCP_AUTO_APPLY = "1";
mkdirSync("./data-test-auto-apply", { recursive: true });

test.after(() => {
  closeDb();
  delete process.env.JOB_MCP_AUTO_APPLY;
  rmSync("./data-test-auto-apply", { recursive: true, force: true });
});

async function call(name: string, args: unknown) {
  const t = toolByName.get(name);
  if (!t) throw new Error(`tool ${name} not found`);
  const parsed = t.inputSchema.safeParse(args);
  if (!parsed.success) throw new Error(parsed.error.message);
  return t.run(parsed.data) as Promise<{ summary: string; data?: any }>;
}

test("auto-apply: enqueue blocked on LinkedIn", async () => {
  openDb();
  resetDb();
  const res = await call("enqueue_apply", { url: "https://www.linkedin.com/jobs/view/1" });
  assert.match(res.summary, /Cannot enqueue|not supported/i);
});

test("auto-apply: execute_autofill with trusted salary default", async () => {
  openDb();
  resetDb();
  getDefaultProfile();
  await call("set_apply_defaults", {
    answers: { salary_expectation: "RM 12000" },
    min_match_score: 0,
  });

  const jobRes: any = await call("analyze_job", {
    description: "Engineer role. Node.js and TypeScript required.",
    title: "Engineer",
  });
  const jobId = jobRes.data.job_id;

  const cvDir = resolve("./data-test-auto-apply", "cvs");
  if (!existsSync(cvDir)) mkdirSync(cvDir, { recursive: true });
  const cvFile = join(cvDir, "cv.txt");
  writeFileSync(cvFile, "Skills: Node.js, TypeScript", "utf8");
  const parseRes: any = await call("parse_cv", { file_path: cvFile });
  const cvId = parseRes.data.cv_id;

  const matchRes: any = await call("match_cv", { job_id: jobId, cv_id: cvId, save: true });
  const appId = matchRes.data.application_id;

  const url = "https://boards.greenhouse.io/test/jobs/1";
  const enq: any = await call("enqueue_apply", { url, job_id: jobId });
  const qid = enq.data.id;
  await call("prepare_application", { queue_id: qid, cv_id: cvId });

  const exec: any = await call("execute_autofill", {
    application_id: appId,
    queue_id: qid,
    url,
    form_fields: [
      { name: "name", label: "Name" },
      { name: "salary", label: "Salary expectation" },
    ],
    issue_approval_token: true,
  });

  const salary = exec.data.mapping.find((m: any) => m.field === "salary");
  assert.equal(salary.value, "RM 12000");
  assert.equal(salary.requires_user_review, false);
  assert.equal(exec.data.can_auto_submit, true);
  assert.ok(exec.data.approval?.approval_token);
});

test("auto-apply: start_campaign enqueues ATS URLs", async () => {
  openDb();
  resetDb();
  getDefaultProfile();
  await call("set_apply_defaults", { min_match_score: 0, max_applies_per_day: 5 });

  const cvDir = resolve("./data-test-auto-apply", "cvs");
  if (!existsSync(cvDir)) mkdirSync(cvDir, { recursive: true });
  const cvFile = join(cvDir, "campaign-cv.txt");
  writeFileSync(cvFile, "Skills: Node.js, TypeScript, React", "utf8");
  const parseRes: any = await call("parse_cv", { file_path: cvFile });

  const url = "https://boards.greenhouse.io/example/jobs/999";
  const camp: any = await call("start_campaign", {
    urls: [url],
    cv_id: parseRes.data.cv_id,
  });
  assert.equal(camp.data.ready_count, 1);
  assert.equal(camp.data.results[0].status, "ready");
  assert.ok(camp.data.results[0].queue_id);
});