# Persona Studio AI Test Strategy

This document defines how we prove the MVP works before shipping changes to production.

## Quality Gates

Every meaningful production change should pass:

- `npm run lint`
- `npm run build`
- `npm run test:unit`
- `npm run test:evals`
- `npm run test:report`
- `npm run quality`

## Test Layers

1. Unit tests

   Covers deterministic product logic:
   - intent detection
   - guardrails
   - fallback responses
   - persona profile normalization
   - web-search gating
   - estimation mode detection

2. Render tests

   Covers app shell and route-level HTML output:
   - landing page renders
   - starter scaffolding is gone
   - key routes remain available

3. AI evals

   Covers response quality with a golden dataset:
   - intent correctness
   - fallback correctness
   - tone expectations
   - safety expectations
   - web-search gating expectations

4. Manual production checks

   Covers real hosted behavior:
   - creator can create/publish persona
   - fan can sign up and chat
   - real questions get grounded answers
   - risky questions do not invent or over-answer

## MVP Production Bar

The MVP is production-test ready when:

- deterministic tests pass
- eval score is 90% or higher
- no critical eval failures exist
- estimation/web-search decisions match the golden dataset
- OpenAI and Supabase health are green
- PM-facing release note is updated
- Test Report is updated
