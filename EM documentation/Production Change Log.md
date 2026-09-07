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
