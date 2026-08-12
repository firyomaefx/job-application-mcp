import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const desktopMain = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
const desktopPackage = JSON.parse(
  readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8")
) as { build: { files: string[] } };

test("packaged desktop launches the bridge with Electron utilityProcess", () => {
  assert.match(desktopMain, /utilityProcess\.fork\(BRIDGE_SCRIPT/);
  assert.doesNotMatch(desktopMain, /spawn\(process\.execPath/);
  assert.doesNotMatch(desktopMain, /ELECTRON_RUN_AS_NODE\s*:/);
  assert.match(desktopMain, /stdio:\s*"pipe"/);
});

test("desktop package includes every local main-process module", () => {
  assert.match(desktopMain, /require\("\.\/version-util\.js"\)/);
  assert.ok(desktopPackage.build.files.includes("version-util.js"));
});
