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
