"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const asar = require("@electron/asar");

const {
  collectLocalDependencyClosure,
  extractStaticModuleSpecifiers,
  missingArchiveEntries,
  normalizeArchiveEntry,
  verifyArchive,
} = require("./verify-package.cjs");

function writeFixture(root) {
  fs.mkdirSync(path.join(root, "renderer"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"main":"main.js"}\n');
  fs.writeFileSync(path.join(root, "main.js"), 'require("./version-util.js");\n');
  fs.writeFileSync(path.join(root, "preload.js"), "module.exports = {};\n");
  fs.writeFileSync(path.join(root, "version-util.js"), "module.exports = {};\n");
  fs.writeFileSync(path.join(root, "renderer", "index.html"), "<main></main>\n");
  fs.writeFileSync(path.join(root, "renderer", "app.js"), "// renderer\n");
  fs.writeFileSync(path.join(root, "renderer", "style.css"), "main {}\n");
  fs.writeFileSync(path.join(root, "bridge-bundle.mjs"), "export {};\n");
}

test("dependency closure recursively discovers local modules", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "job-mcp-dependency-"));
  try {
    fs.mkdirSync(path.join(root, "lib"));
    fs.writeFileSync(path.join(root, "main.js"), 'require("./lib/first.js");\n');
    fs.writeFileSync(path.join(root, "preload.js"), "// no local dependencies\n");
    fs.writeFileSync(path.join(root, "lib", "first.js"), 'import("../version-util.js");\n');
    fs.writeFileSync(path.join(root, "version-util.js"), "module.exports = {};\n");
    assert.deepEqual(collectLocalDependencyClosure(root, ["main.js", "preload.js"]), [
      "lib/first.js",
      "main.js",
      "preload.js",
      "version-util.js",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("dependency closure fails when a local dependency is absent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "job-mcp-dependency-"));
  try {
    fs.writeFileSync(path.join(root, "main.js"), 'require("./missing.js");\n');
    assert.throws(() => collectLocalDependencyClosure(root, ["main.js"]), /does not exist/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("AST scan ignores comments and resolves provably static module expressions", () => {
  assert.deepEqual(
    extractStaticModuleSpecifiers(
      '// require("./comment-only.js")\nrequire(`./version-util.js`); import("./" + "preload.js"); require.resolve("./worker.js");',
      "fixture.js",
    ).sort(),
    ["./preload.js", "./version-util.js", "./worker.js"],
  );
});

test("AST scan rejects non-static module paths", () => {
  assert.throws(
    () => extractStaticModuleSpecifiers("require(moduleName);", "fixture.js"),
    /non-static require module specifier/i,
  );
});

test("archive path checks are platform independent and catch the original omission", () => {
  assert.equal(normalizeArchiveEntry("\\version-util.js"), "/version-util.js");
  assert.deepEqual(
    missingArchiveEntries(
      ["/main.js", "/preload.js", "/renderer/index.html"],
      ["main.js", "preload.js", "version-util.js", "renderer/index.html"],
    ),
    ["/version-util.js"],
  );
});

test("actual ASAR verification fails on a missing local module and stale code", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "job-mcp-asar-verifier-"));
  const source = path.join(root, "source");
  const staging = path.join(root, "staging");
  const resources = path.join(root, "resources");
  const archive = path.join(resources, "app.asar");
  try {
    writeFixture(source);
    fs.mkdirSync(resources, { recursive: true });
    fs.copyFileSync(path.join(source, "bridge-bundle.mjs"), path.join(resources, "bridge-bundle.mjs"));

    fs.cpSync(source, staging, { recursive: true });
    fs.rmSync(path.join(staging, "version-util.js"));
    await asar.createPackage(staging, archive);
    assert.throws(() => verifyArchive(archive, source), /missing packaged runtime files.*version-util/i);
    asar.uncache(archive);

    fs.rmSync(staging, { recursive: true, force: true });
    fs.cpSync(source, staging, { recursive: true });
    fs.writeFileSync(path.join(staging, "main.js"), "module.exports = {};\n");
    fs.rmSync(archive, { force: true });
    await asar.createPackage(staging, archive);
    assert.throws(() => verifyArchive(archive, source), /contains stale runtime files.*main\.js/i);
    asar.uncache(archive);

    fs.rmSync(archive, { force: true });
    await asar.createPackage(source, archive);
    assert.doesNotThrow(() => verifyArchive(archive, source));
    asar.uncache(archive);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
