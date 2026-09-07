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

## 2026-09-07: Clickable Chat Links and Complete Answers

What changed:
- Source URLs in persona replies now render as clickable links.
- Web-backed and number-heavy case-study replies get more room to complete.
- Prompt instructions now prefer fewer complete points over unfinished long lists.

Why it changed:
- Links were displayed as raw Markdown text, and some long answers were cut off.

User impact:
- Chat replies are easier to read, and sources are easier to open.

Risk:
- Low.

Validation:
- Lint: passed with existing warnings.
- Build: passed.
- Tests: passed.
- Evals: 100% across 18 golden cases.

Post-deploy check:
- Ask for a number-heavy case study and verify links plus answer completion.

## 2026-09-07: Resolved Case-Study Follow-Ups

What changed:
- Short follow-ups in case-study conversations are expanded internally with the active company/context before AI generation.
- Swiggy-style prompts like "Explain me with some numbers" followed by "user growth" now route as a Swiggy numeric case-study question.

Why it changed:
- The AI was answering generic growth advice because the latest fan message was too short for web search and OpenAI to understand by itself.

User impact:
- Case-study coaching feels more continuous and gives numbers when the fan asks for numbers.

Risk:
- Low.

Validation:
- Lint: passed with existing warnings.
- Build: passed.
- Tests: passed.
- Evals: 100% across 18 golden cases.

Post-deploy check:
- Test the Swiggy business case flow and ask "user growth".

## 2026-09-07: Contextual Follow-Up Intent

What changed:
- Fan chat now uses recent conversation history before deciding a short message is vague.
- Short case-study follow-ups like "Target market" continue the active discussion.
- "Target market" no longer triggers live market-data routing.

Why it changed:
- Natural conversations often use fragments after context has already been established.

User impact:
- Guided case studies and coaching conversations feel smoother.

Risk:
- Low.

Validation:
- Lint: passed with existing warnings.
- Build: passed.
- Tests: passed.
- Evals: 100% across 17 golden cases.

Post-deploy check:
- Run the Zepto case-study flow and send "Target market".

## 2026-09-07: Fan Session Refresh

What changed:
- Fan sessions are refreshed before chat history and conversation start calls.
- Expired saved sessions now reset to a clear sign-in state.
- Removed confusing backend-facing auth wording from the fan start flow.

Why it changed:
- Fans could appear signed in locally while the backend rejected an expired token.

User impact:
- Cleaner login recovery and fewer confusing blocked chat starts.

Risk:
- Low.

Validation:
- Lint: passed with existing warnings.
- Build: passed.
- Tests: passed.
- Evals: 100% across 16 golden cases.

Post-deploy check:
- Sign in as a fan and start a conversation from `/p/chirag`.

## 2026-09-07: Persona-Relevant Web Calling Gate

What changed:
- Web calling now requires two checks: the fan question must need live public facts, and the live facts must fit the creator's approved domain.
- Off-domain live requests return a short boundary response instead of using web search.
- Weather, currency, market/rate, and current public fact routing now consider creator relevance.

Why it changed:
- Prevents fan misuse where a creator persona becomes a generic internet lookup bot.

User impact:
- More controlled and creator-grounded fan chat behavior.

Risk:
- Medium, because some broad live-info queries will now be rejected unless they connect to the creator persona.

Validation:
- Lint: passed with existing warnings.
- Build: passed.
- Tests: passed.
- Evals: 100% across 16 golden cases.

Post-deploy check:
- Test one off-domain live lookup and one in-domain live lookup.

## 2026-09-07: Live Public Info Routing

What changed:
- Added explicit routing for live public information questions such as weather, exchange rates, current market/rate lookups, trends, news, and disaster context.
- Added `externalInfoNeed` metadata to support debugging and PM reporting.
- Updated the OpenAI prompt so when web search is enabled, the model should use web results for the factual answer and then respond through the creator persona.
- Expanded golden eval coverage to 16 cases.

Why it changed:
- Tool calling should support real information from the internet when the fan asks for current public facts, not only creator-provided context.

User impact:
- Fan chat can better handle questions like "What is the weather in Nepal today?" and "What is USD to INR today?"

Risk:
- Medium, because live-info routing changes runtime answer behavior.

Validation:
- Lint: passed with existing warnings.
- Build: passed.
- Tests: passed.
- Evals: 100% across 16 golden cases.

Post-deploy check:
- Test one weather query and one currency query in fan chat.

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
