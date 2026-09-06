# Production Change Log

Use this file to track what changes are pushed to production and why they matter.

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
