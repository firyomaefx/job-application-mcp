import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { saveIncomingResume, sanitizeIncomingFilename } from "../src/edge/local-ingest.js";

process.env.JOB_MCP_DATA_DIR = "./data-test-edge-ingest";
mkdirSync("./data-test-edge-ingest", { recursive: true });

test.after(() => {
  rmSync("./data-test-edge-ingest", { recursive: true, force: true });
});

test("sanitizeIncomingFilename strips path segments", () => {
  assert.equal(sanitizeIncomingFilename("../../evil.pdf"), "evil.pdf");
});

test("saveIncomingResume writes under data/incoming", () => {
  const path = saveIncomingResume("cv.pdf", Buffer.from("%PDF-1.4 test"));
  assert.ok(path.includes("incoming"));
  assert.ok(existsSync(path));
  assert.equal(readFileSync(path).toString(), "%PDF-1.4 test");
  assert.ok(join(process.cwd(), "data-test-edge-ingest", "incoming").length > 0);
});