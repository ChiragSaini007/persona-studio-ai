# Production Change Log

Use this file to track what changes are pushed to production and why they matter.

## 2026-09-07: MVP Quality Layer, Web-Aware Runtime, and App Structure

What changed:
- Added PM, EM, and Test documentation areas.
- Added a golden dataset with 3 personas and 12 fan-prompt eval cases.
- Added automated runtime unit tests for intent, guardrails, fallback behavior, and web-search gating.
- Added `npm run quality` as the release gate for lint, build, tests, evals, and test report generation.
- Added runtime metadata for fan chat decisions: intent, RAG usage, web usage, retrieved chunks, web source count, and runtime errors.
- Added gated OpenAI web search support for real public questions that need current/external context.
- Added clean creator route entry points for onboarding and review.

Why it changed:
- The MVP needs measurable quality before deeper product expansion.
- PMs need visibility into what changed and whether the app is production-test ready.
- Fan answers should stay creator-grounded but still support public/current questions when creator content is insufficient.

User impact:
- Safer runtime behavior.
- More reliable releases.
- Better reporting for future improvements.
- Cleaner creator navigation.

Validation:
- Quality command passed.
- Unit tests passed.
- Render tests passed.
- Golden eval score: 100% across 12 cases.

Post-deploy check:
- Test `/creator`, `/creator/onboarding`, `/creator/review`, and `/p/chirag`.
- Ask fan-chat prompts for greeting, vague, real, risky, and web-needed questions.
- Confirm the test report remains green.

## 2026-09-07: Resolved Case-Study Follow-Up Questions

What changed:
- Added question resolution for short follow-ups inside business case conversations.
- Follow-ups like "Explain me with some numbers" and "user growth" are now expanded internally into the active case context before retrieval, web gating, and OpenAI generation.
- Added Swiggy numeric follow-up coverage to the golden dataset.

Why it changed:
- Web search was seeing "user growth" too literally and returning generic growth advice instead of Swiggy-specific numbers.

User impact:
- Case-study conversations should stay anchored to the company and section the fan is discussing.
- Numeric follow-ups should request concrete figures when current public data is needed and persona relevance allows it.

Validation:
- Unit tests passed.
- Golden eval score: 100% across 18 cases.

Post-deploy check:
- In `/p/chirag`, ask for a Swiggy business case, ask for numbers, then say "user growth".
- Confirm the answer stays about Swiggy and uses numbers.

## 2026-09-07: Contextual Follow-Up Intent

What changed:
- Added history-aware intent detection for short follow-ups inside active case-study or framework conversations.
- Short phrases like "Target market", "Pricing", and "Competitors" now continue the current case study instead of being treated as vague standalone prompts.
- Prevented "target market" from being misclassified as live market data.
- Added a golden eval case for the Zepto target-market follow-up flow.

Why it changed:
- Fans often reply with short natural fragments during a guided conversation.
- The product should use recent chat context before asking the fan to rephrase.

User impact:
- Case-study and coaching flows feel more natural and less brittle.

Validation:
- Unit tests passed.
- Golden eval score: 100% across 17 cases.

Post-deploy check:
- In `/p/chirag`, start a Zepto case study, then reply "Target market".
- Confirm the persona continues with Zepto target-market analysis.

## 2026-09-07: Fan Session Refresh and Login Error Cleanup

What changed:
- Added fan session refresh before loading chat history or starting a conversation.
- If a saved session is expired, the fan page clears it and asks the user to sign in again.
- Replaced backend-facing "Fan login required" behavior with a cleaner fan-facing sign-in message.

Why it changed:
- The fan page could trust an old browser token, hide the login form, then fail when the backend rejected the token.

User impact:
- Fans get a clear path to sign in again instead of seeing confusing auth copy.

Validation:
- Unit tests passed.
- Golden eval score: 100% across 16 cases.

Post-deploy check:
- Open `/p/chirag`, sign in, and start a conversation.
- If an old token exists, confirm the page asks the fan to sign in again cleanly.

## 2026-09-07: Persona-Relevant Web Calling Gate

What changed:
- Tightened web calling so live public information is fetched only when the fan question both requires current facts and fits the creator's approved domain.
- Added persona relevance checks for weather, currency, market/rate, and general live public fact questions.
- Added a clean out-of-scope response for live-info requests that would turn the product into a generic internet assistant.
- Updated evals so "What is the weather in Nepal today?" is detected as weather but does not call web for Chirag's product/business persona.

Why it changed:
- Fans should not be able to misuse a creator persona as a general web-search bot.
- Web context should support the creator's POV, not replace it.

User impact:
- Better guardrails around off-domain live lookups.
- Relevant live-info questions can still use current public context.

Validation:
- Unit tests passed.
- Golden eval score: 100% across 16 cases.

Post-deploy check:
- Ask `/p/chirag`: "What is the weather in Nepal today?" It should not perform a generic weather lookup.
- Ask `/p/chirag`: "I want to estimate Nepal flood damage in INR." It should still use live context because it fits an estimation/business reasoning flow.

## 2026-09-07: Live Public Info Routing

What changed:
- Added an explicit external-info classifier for live public fact, weather, currency, and market/rate questions.
- Expanded web-search gating so weather and exchange-rate questions trigger live public context after the message is classified as a real question.
- Updated the OpenAI runtime prompt so live-info answers use web results for the factual part instead of saying the persona lacks real-time data.
- Added API metadata for `externalInfoNeed` so we can debug whether a question required live information.
- Expanded the golden dataset with weather and USD-to-INR routing cases.

Why it changed:
- Fans may ask questions that are outside the creator's stored content but still need real public information.
- The persona should use live public sources when required, then explain the answer in the creator's style.

User impact:
- Better answers for weather, exchange rates, market/rate questions, current news, disaster estimates, and similar public facts.
- Clearer runtime reporting for whether a tool-backed answer path was selected.

Validation:
- Unit tests passed.
- Golden eval score: 100% across 16 cases.

Post-deploy check:
- Ask `/p/chirag`: "What is the weather in Nepal today?"
- Ask `/p/chirag`: "What is USD to INR today?"
- Confirm both are treated as live public information questions.

## 2026-09-07: Estimation Mode for Web-Assisted Fan Questions

What changed:
- Added estimation mode for questions involving estimates, calculations, damage, loss, cost, currency, ranges, or market size.
- Updated web-search gating so estimation questions only use web when they also need public/current facts.
- Updated OpenAI prompt instructions so estimation answers give assumptions, simple math, ranges, and confidence instead of generic research advice.
- Switched OpenAI web tool configuration to the official `web_search_preview` tool shape.
- Expanded the golden dataset with Nepal-flood-style INR estimation coverage.

Why it changed:
- Fans asking "help me estimate this" need an actual model/example, not a generic list of places to research.
- Creator persona answers should remain useful and grounded even when web context is needed.

User impact:
- Better answers for estimation and current-event analysis questions.
- Lower chance of unnecessary web lookups.
- Better reporting through answer-mode and web-search eval metrics.

Validation:
- Unit tests passed.
- Golden eval score: 100% across 14 cases.

Post-deploy check:
- Ask `/p/chirag`: "I want to estimate the damage that has happened in Nepal floods in INR."
- Confirm the answer gives assumptions, rough ranges, and simple calculation logic.

## 2026-09-06: Fan Chat Answer Quality and Formatting

What changed:
- Added fan chat thinking states such as "Chirag is thinking..."
- Improved greeting detection for messages like "Hey Chirag, how are you? Big fan"
- Increased AI answer length so responses do not stop mid-thought
- Cleaned AI reply formatting so answers read like chat, not raw Markdown
- Preserved line breaks inside persona replies
- Fixed creator-name fallback text when the fan page is still loading

Why it changed:
- Fan chat felt frozen while waiting for an answer.
- Social greetings were incorrectly treated as real product questions.
- Some answers looked cut off.
- Some answers displayed raw Markdown like `**bold text**`.

User impact:
- Fans get clearer feedback while the AI is responding.
- Greetings feel natural.
- Real answers are more complete and easier to read.

Validation:
- Lint passed with only existing warnings.
- Build passed.
- Tests passed.
- Production health check showed Supabase and OpenAI connected.

Post-deploy check:
- Test `/p/chirag`.
- Send a greeting.
- Send a real question.
- Confirm the answer finishes cleanly and is readable.

## 2026-09-06: System Prompt and Intent Logic Clarification

What changed:
- Documented how the system prompt is assembled.
- Documented how fan messages are classified as greeting, vague, question, or risky.

Why it changed:
- Product needs visibility into why the AI behaves a certain way.
- PM review needs a clear mental model before approving further runtime changes.

User impact:
- Easier to debug answer quality.
- Easier to define expected behavior for new persona flows.

Validation:
- Reviewed current runtime code paths.

Post-deploy check:
- Use this documentation while testing fan chat behavior.
