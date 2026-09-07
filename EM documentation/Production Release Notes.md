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

## 2026-09-07: Estimation Mode

What changed:
- Added estimation answer mode.
- Improved web-search gating for damage/cost/loss/current public questions.
- Added Nepal-flood-style estimation case to golden evals.
- Updated runtime prompt to avoid generic research advice for estimation questions.

Why it changed:
- Fans need useful estimation frameworks with assumptions and rough ranges.

User impact:
- Estimation answers should feel more like creator-guided reasoning.

Risk:
- Medium, because web tool behavior and answer style changed.

Validation:
- Unit tests: passed.
- Evals: 100% across 14 golden cases.

Post-deploy check:
- Ask a current-event estimation question in fan chat.

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
