import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { closeDb, openDb, resetDb } from "../src/store/db.js";
import { checkThisJob, NO_CV_SAY, saveMyCv } from "../src/simple.js";
import { listedTools } from "../src/server.js";
import { tools } from "../src/tools/index.js";
import { checkThisJobTool, saveMyCvTool } from "../src/tools/simple.js";
import { toContent, type ToolResult } from "../src/tools/types.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-simple";
delete process.env.JOB_MCP_ALL_TOOLS;

test.beforeEach(() => {
  resetDb();
});

test.after(() => {
  delete process.env.JOB_MCP_ALL_TOOLS;
  closeDb();
});

function asResult(result: ToolResult | Promise<ToolResult>): ToolResult {
  if (result instanceof Promise) throw new Error("expected a sync tool result");
  return result;
}

function counts(): { profiles: number; cvs: number; jobs: number } {
  const db = openDb();
  const n = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return { profiles: n("profiles"), cvs: n("cvs"), jobs: n("jobs") };
}

test("checking a job with no CV stops and writes nothing", () => {
  const result = checkThisJob({
    description: "Backend engineer\nWe need Python, SQL, and AWS.",
  });
  assert.equal(result.say, NO_CV_SAY);
  assert.equal(result.say, "No CV saved. Paste your CV first.");
  assert.deepEqual(counts(), { profiles: 0, cvs: 0, jobs: 0 });
});

test("a saved CV then a job returns a score and only names matched skills", () => {
  const saved = saveMyCv("Ada Lovelace. Python and SQL. Built data pipelines.");
  assert.match(saved.say, /^Saved\. \d+ skills found: .+\. Paste a job next\.$/);

  const card = checkThisJob({
    description: "Staff Engineer at Acme\nWe need Python, SQL, and AWS. Docker is a plus.",
  });
  const lines = card.say.split("\n");
  assert.equal(lines[0], "Role: Untitled role");
  assert.match(lines[1], /^Score: \d+\/100$/);
  assert.match(lines[2], /^In both: /);
  assert.match(lines[2], /python/);
  assert.match(lines[2], /sql/);
  assert.doesNotMatch(lines[2], /aws/);
  assert.match(lines[3], /^Only in the job: /);
  assert.match(lines[3], /aws/);
  assert.deepEqual(lines.slice(4), [
    lines[4],
    "These are the only skills this card supports.",
    "Do not add employers.",
    "Do not add dates.",
    "Do not add numbers.",
  ]);
  assert.match(lines[4], /^Matched skills you can name: /);
  assert.match(lines[4], /python/);
  assert.doesNotMatch(lines[4], /aws/);
  assert.equal(lines.length, 9);
  assert.equal(counts().jobs, 0);
  assert.equal(counts().cvs, 1);
});

test("a passed title is used and a missing title is never guessed from the posting", () => {
  saveMyCv("Python and SQL.");
  const named = checkThisJob({ description: "First line is not a title. Python.", title: "Backend Engineer" });
  assert.match(named.say, /^Role: Backend Engineer/);
  const unnamed = checkThisJob({ description: "First line is not a title. Python." });
  assert.match(unnamed.say, /^Role: Untitled role/);
  assert.doesNotMatch(unnamed.say, /First line is not a title/);
});

test("saving again keeps a single active CV", () => {
  saveMyCv("Python only.");
  saveMyCv("SQL only.");
  const db = openDb();
  const active = db.prepare("SELECT text FROM cvs WHERE is_active = 1").all() as { text: string }[];
  assert.deepEqual(active.map((row) => row.text), ["SQL only."]);
});

test("blank CV text is not stored", () => {
  assert.equal(saveMyCv("   ").say, "Paste your CV text.");
  assert.deepEqual(counts(), { profiles: 0, cvs: 0, jobs: 0 });
});

test("default tool list is the two paste tools and returns text only", () => {
  assert.deepEqual(
    listedTools().map((t) => t.name),
    ["save_my_cv", "check_this_job"],
  );
  const saved = asResult(saveMyCvTool.run({ text: "Python and SQL." }));
  const checked = asResult(checkThisJobTool.run({ description: "Python and AWS." }));
  assert.equal(toContent(saved).length, 1);
  assert.equal(toContent(checked).length, 1);
  assert.equal(toContent(checked)[0]?.text.split("\n")[0], "Role: Untitled role");
});

test("JOB_MCP_ALL_TOOLS=1 lists the existing 41 tools", () => {
  process.env.JOB_MCP_ALL_TOOLS = "1";
  try {
    assert.equal(tools.length, 41);
    assert.equal(listedTools().length, 41);
    assert.deepEqual(
      listedTools().map((t) => t.name),
      tools.map((t) => t.name),
    );
  } finally {
    delete process.env.JOB_MCP_ALL_TOOLS;
  }
});

test("cli cv and job print the same card", () => {
  const dir = mkdtempSync(join(tmpdir(), "job-mcp-simple-"));
  const cvPath = join(dir, "cv.txt");
  const jobPath = join(dir, "job.txt");
  writeFileSync(cvPath, "Python and SQL.\n");
  writeFileSync(jobPath, "Staff Engineer at Acme\nPython, SQL, and AWS.\n");
  const env: NodeJS.ProcessEnv = { ...process.env, JOB_MCP_DATA_DIR: join(dir, "data") };
  delete env.JOB_MCP_ALL_TOOLS;
  const cv = spawnSync(process.execPath, ["--import", "tsx", "cli/cli.ts", "cv", cvPath], {
    env,
    encoding: "utf8",
  });
  assert.equal(cv.status, 0, cv.stderr);
  assert.match(cv.stdout, /^Saved\./);
  const job = spawnSync(process.execPath, ["--import", "tsx", "cli/cli.ts", "job", jobPath], {
    env,
    encoding: "utf8",
  });
  assert.equal(job.status, 0, job.stderr);
  assert.match(job.stdout, /^Role: Untitled role/);
  assert.match(job.stdout, /Only in the job: .*\baws\b/);
  assert.doesNotMatch(job.stdout, /Matched skills you can name: .*\baws\b/);
});
