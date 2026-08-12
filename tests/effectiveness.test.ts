import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateEffectiveness,
  renderMarkdown,
  type EffectivenessBaseline,
} from "../evals/run-effectiveness.js";

const baseline = JSON.parse(
  readFileSync("evals/effectiveness-baseline.json", "utf8"),
) as EffectivenessBaseline;

test("daily effectiveness fixtures meet the checked-in baseline", () => {
  const report = evaluateEffectiveness(baseline, "2026-01-01T00:00:00.000Z");
  assert.equal(report.passed, true);
  assert.ok(report.metrics.every((item) => item.passed));
  assert.equal(report.scope.external_model_calls, false);
  assert.equal(report.scope.user_data_used, false);
});

test("daily effectiveness report discloses its limits", () => {
  const markdown = renderMarkdown(evaluateEffectiveness(baseline, "2026-01-01T00:00:00.000Z"));
  assert.match(markdown, /does not prove interview outcomes/i);
  assert.match(markdown, /evidence provenance/i);
});
