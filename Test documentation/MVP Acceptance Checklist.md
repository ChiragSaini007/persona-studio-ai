# Persona Studio AI MVP Acceptance Checklist

## Creator Flow

- Landing page explains the product clearly.
- Creator can sign up or sign in.
- First-time creator sees guided onboarding.
- Returning creator sees dashboard.
- Creator can enter name and handle.
- Creator can add source content.
- Creator can add example Q&A replies.
- Creator can add never-say rules.
- Creator can generate a persona.
- Creator can publish persona.
- Creator gets a shareable `/p/[handle]` fan link.

## Fan Flow

- Fan can sign up or sign in.
- Fan can start a conversation.
- Greeting gets a natural short response.
- Vague message asks a follow-up.
- Real question is routed to OpenAI.
- Risky/private question gets fallback.
- Chat shows thinking state while generating.
- Fan can see prior conversations.

## Runtime Flow

- Intent classification works.
- Guardrails work.
- RAG retrieval works.
- Web search only runs for real questions that need external/current context.
- Estimation questions produce assumptions, simple math, and rough ranges instead of generic "go research this" advice.
- Responses do not claim to be the real creator.
- Responses do not invent private facts.
- Responses are readable in chat format.

## Reporting

- Test report is updated.
- Production change log is updated.
- Release note states what changed and why.

## Admin and video additions
- [ ] Managed avatar cannot go live without rights, approval, and territory match
- [ ] Editing reviewed fields pauses the avatar and resets approval
- [ ] Brain test answers in persona and credits do not drop
- [ ] Wrong brain secret returns 401; paused avatar returns 404
- [ ] Fan video page (not built) shows AI label, limits and kill switch
