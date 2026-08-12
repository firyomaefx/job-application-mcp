# Daily Effectiveness Gate

## Purpose

The scheduled GitHub Actions workflow detects regressions in the product's current, verified local workflow. It runs every day at 01:17 UTC (09:17 Malaysia time) and can also be dispatched manually.

It does not modify source code, application data, releases, or user documents. A failed run opens or updates one regression issue; a later successful run closes it.

## Checks

- Locked dependency installation, type-check, build, and the full test suite.
- Match discrimination across small Malaysia-oriented role fixtures.
- Recall of deliberately missing job requirements.
- Containment of hostile instructions embedded in job descriptions.
- A machine-readable JSON report and a concise Markdown report retained as workflow artifacts for 30 days.

Thresholds live in `evals/effectiveness-baseline.json`. Raising a threshold or adding a fixture requires review in a pull request. Lowering a threshold must include evidence and must not be used merely to make CI green.

## Privacy and cost

Fixtures are synthetic. The workflow reads no CV, job, database, provider key, or production secret. It makes no model, Hugging Face, Cloudflare, browser, payment, or employer-site call.

Model-based evaluation was rejected for this gate because daily results must remain deterministic, free to run, and independent of a particular AI provider. Cloudflare Cron Triggers were also rejected because GitHub Actions already owns repository validation; adding a second scheduler would increase credentials and infrastructure without improving this local-first gate.

## Limits

Passing proves only that the checked-in deterministic baseline and repository validation succeeded. It does not prove ATS ranking, interview conversion, employer response, multilingual quality, or evidence provenance. Evidence-locked claim provenance remains the next high-value product milestone.
