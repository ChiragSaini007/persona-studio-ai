# Persona Studio Design Upgrade

## Product Read

Persona Studio is not a generic chatbot builder. It is a creator operations surface for shaping a public voice, approving its boundaries, publishing a fan DM link, and reviewing what happens after launch.

The first-pass redesign treats the product as three connected experiences:

- Editorial landing page for creators and public figures.
- Creator studio with an interview-style onboarding flow and returning dashboard.
- Public fan chat that feels like a DM thread while making AI disclosure and grounding visible.

## Benchmarks

- Instagram DM and iMessage: fast fan mental model, compact bubbles, clear send affordance.
- Linear and Stripe dashboards: dense operational surfaces, restrained panels, low decoration.
- Substack and creator media pages: editorial landing rhythm with brand-first storytelling.
- Intercom-style support chat: persistent thread header, disclosure, history, and suggested prompts.
- Character chat products: immediate conversational affordance, but with stronger creator approval and safety framing.

## Design Decisions

- Make the landing hero creator-led. The first viewport now pairs a generated creator portrait with the product promise so the brand immediately signals public identity, fan access, and approval.
- Reduce card weight across the app. Panels now use 8px corners, light borders, and table/strip layouts instead of stacked rounded cards.
- Keep creator setup as an interview. Step 2 centers one question at a time, uses a progress meter, and shows a live fan preview with source and guardrail signals.
- Make returning login valuable. Saved creators land in dashboard mode with persona status, fan link controls, portfolio, metrics, and review queue.
- Make fan chat feel like a DM. The public page now has a thread header, avatar, compact disclosure, assistant/fan bubble geometry, thinking state, suggested follow-ups, and visible source strips on persona replies.
- Preserve runtime behavior. Auth, Supabase persona loading, OpenAI persona generation, RAG/web-source flags, moderation, publishing, and Stripe checkout paths were left in place.

## Critic Loop

The critic reviewed screenshots only, without code or implementation context.

- Baseline score: 5.5/10. Main gaps were generic SaaS tropes, weak creator identity, too many rounded containers, and a fan page that felt like a compliance demo.
- Iteration 1 score: 5.2/10. The landing page improved, but the critic still saw too much template composition, color noise, and weak task-level polish in onboarding and fan chat.
- Execution response: introduced creator portraiture, removed the random blue accent, simplified nav framing, tightened fan preview copy, softened repetitive source labels, and fixed a fan auth restore issue that could incorrectly show "login required."
- Later critic score: 7.5/10, then 7/10 after a width-regression screenshot. The release blocker was fan-page horizontal overflow.
- Final response: fixed fan-page overflow, centered chat as the main experience, added landing hero proof, made fan copy less demo-like, added creator-photo treatment to the chat preview, and added clearer disabled CTA guidance in onboarding.
- Final critic did not provide a numeric score despite being asked. Its qualitative judgment was still below the 9/10 studio bar: stronger than before, but still needing a more distinctive creator-voice identity system and simpler first-step onboarding.

## Current Design Debt

- Creator onboarding should become more conversational in the UI itself: one prompt, one answer, one live preview moment, then continue.
- Fan chat needs richer creator presence once creator avatar/media upload exists.
- Trust should move from repeated labels into calmer states: source drawer, disclosure badge, and reviewable event history.
- The landing page should eventually break the repeated two-column section pattern with a stronger product proof section.

## Anti-Slop Rules

- No decorative blob/orb backgrounds.
- No oversized generic SaaS cards for every section.
- No vague "AI magic" copy.
- No hidden disclosure: fan chat keeps AI and grounding context visible.
- No new dependencies for this pass.

## Next Pass

- Add real creator imagery/avatar upload once uploads exist.
- Return actual source titles/URLs from the chat API when web retrieval is used.
- Add mobile visual QA screenshots for creator onboarding and fan chat.
- Add a compact conversation insight view for the review queue.
