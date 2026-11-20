import { test } from "node:test";
import assert from "node:assert/strict";
import { getAdapterHints, listAdapterIds } from "../src/apply/adapters/index.js";

test("adapter registry includes greenhouse and generic", () => {
  const ids = listAdapterIds();
  assert.ok(ids.includes("greenhouse"));
  assert.ok(ids.includes("generic"));
  const g = getAdapterHints("greenhouse");
  assert.ok(g.submit_selectors.length > 0);
  assert.ok(g.file_input_selectors && g.file_input_selectors.length > 0);
  const w = getAdapterHints("workday");
  assert.ok(w.next_selectors && w.next_selectors.length > 0);
});