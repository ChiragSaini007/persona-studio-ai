# Persona Studio AI Production Release Notes

Use this file for PM/EM-readable summaries of production pushes.

## 2026-09-07: MVP Quality Layer and Web-Aware Runtime

What changed:
- Added PM, EM, and Test documentation split.
- Added golden dataset and eval metrics.
- Added unit tests and quality command.
- Added gated web-search support for real questions that need public/current context.
- Added chat runtime metadata for reporting.
- Added creator onboarding/review route entry points.

Why it changed:
- Improve production confidence before expanding the product.
- Give PM/EM visibility into runtime decisions and quality scores.

User impact:
- More reliable fan answers.
- Better guardrail checks.
- Cleaner reporting for future improvements.

Risk:
- Medium, because runtime prompt/tool behavior changed.

Validation:
- Lint: passed with existing warnings.
- Build: passed.
- Tests: passed.
- Evals: 100% across 12 golden cases.

Post-deploy check:
- Open `/p/chirag`.
- Test greeting, vague, real, risky, and web-needed prompts.
- Open `/creator`, `/creator/onboarding`, and `/creator/review`.

## Template

```text
Release:
Date:

What changed:
-

Why it changed:
-

User impact:
-

Risk:
- Low / Medium / High

Validation:
- Lint:
- Build:
- Tests:
- Evals:

Post-deploy check:
-
```
