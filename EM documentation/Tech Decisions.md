# Persona Studio AI Tech Decisions

## Current Stack

- Frontend: Next.js, React, TypeScript
- Backend: Next.js API routes
- Auth: Supabase Auth
- Database: Supabase Postgres
- Vector search: Supabase pgvector
- AI: OpenAI Responses API
- Embeddings: OpenAI embeddings
- Moderation: OpenAI moderation
- Payments: Stripe later
- Hosting: OpenAI Sites / Cloudflare-backed runtime

## Runtime Decision

Real fan questions use OpenAI. Greetings, vague prompts, and risky prompts can be handled locally to reduce cost and avoid random over-answering.

## Model Decision

Use `gpt-5-mini` as the default production text model for fan replies and persona/profile generation.

Why:

- It gives the best quality-to-cost balance for the MVP fan experience.
- Persona quality is the product, so the default should not be the cheapest model.
- Larger models should be reserved for future premium tiers, eval failure retries, or high-value creator accounts.

Model policy:

- Fan chat replies: `gpt-5-mini`
- Persona/profile generation: `gpt-5-mini`
- Intent routing: deterministic code first; use a cheaper model only if routing quality becomes a measurable issue
- Embeddings/RAG: `text-embedding-3-small`
- Moderation: `omni-moderation-latest`

The runtime fallback order should keep `gpt-5-mini` first. Older mini models are fallback options only if the configured model fails.

## Web Search Decision

Web search is allowed only after:

1. the message is classified as a real question
2. moderation and guardrails pass
3. creator RAG context is insufficient or the question needs current public facts

Web search is not a replacement for creator persona grounding.

## Estimation Decision

Questions about estimating, calculating, damage, loss, cost, currency conversion, or market size use estimation mode.

Estimation mode should:

- answer through the creator's thinking style
- define the scope
- make assumptions explicit
- show simple math
- provide low/base/high ranges when possible
- use web search only when current public facts are needed
- avoid generic "go look at reports" answers
