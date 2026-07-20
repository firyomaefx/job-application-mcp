import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

// desktop/version-util.js is CommonJS; load it from ESM via createRequire.
const require = createRequire(import.meta.url);
const { parseVer, isUpdateAvailable } = require(
  path.resolve(import.meta.dirname, "..", "desktop", "version-util.js")
) as {
  parseVer: (v: unknown) => [number, number, number] | null;
  isUpdateAvailable: (current: unknown, latest: unknown) => boolean;
};

test("parseVer handles leading v, plain, and pre-release suffix", () => {
  assert.deepEqual(parseVer("0.3.0"), [0, 3, 0]);
  assert.deepEqual(parseVer("v1.2.3"), [1, 2, 3]);
  assert.deepEqual(parseVer("V2.0.1"), [2, 0, 1]);
  assert.deepEqual(parseVer("1.2.3-rc.1"), [1, 2, 3]); // pre-release ignored
});

test("parseVer rejects malformed input with null (never throws)", () => {
  assert.equal(parseVer(null), null);
  assert.equal(parseVer(undefined), null);
  assert.equal(parseVer(""), null);
  assert.equal(parseVer("latest"), null);
  assert.equal(parseVer("1.2"), null);
});

test("isUpdateAvailable: strictly newer latest => true", () => {
  assert.equal(isUpdateAvailable("0.2.2", "0.3.0"), true);
  assert.equal(isUpdateAvailable("1.0.0", "1.0.1"), true);
  assert.equal(isUpdateAvailable("1.0.0", "2.0.0"), true);
  assert.equal(isUpdateAvailable("v0.2.2", "v0.3.0"), true);
});

test("isUpdateAvailable: equal or older latest => false (no downgrade/loop)", () => {
  assert.equal(isUpdateAvailable("0.3.0", "0.3.0"), false);
  assert.equal(isUpdateAvailable("0.3.0", "0.2.2"), false);
  assert.equal(isUpdateAvailable("1.2.3", "1.2.2"), false);
});

test("isUpdateAvailable: malformed remote feed never prompts (defense-in-depth)", () => {
  assert.equal(isUpdateAvailable("0.3.0", null), false);
  assert.equal(isUpdateAvailable("0.3.0", "garbage"), false);
  assert.equal(isUpdateAvailable(null, "0.4.0"), false);
});