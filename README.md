# Fanline (Persona Studio AI)

Two products on one codebase, live at https://persona-studio-ai-three.vercel.app

1. **Fanline** (`/creator`, `/p/[handle]`): creators and public figures sign up themselves, create any number of AI avatars, approve them, and share a fan link.
2. **Admin Portal** (`/admin`): only the Ops team signs in. They build avatars on behalf of creators and celebrities whose agreements are handled outside the tool. Scope is the AI avatar only.

Channels, in priority order: text, voice replies, real-time voice, video, real-time video. Markets: India and US.

## Stack
Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage, RLS) · OpenAI (chat, TTS, transcription, Realtime voice) · HeyGen (recorded video, wallet connected, not generating yet) · LiveAvatar (real-time video, sandbox tested) · Vercel.

## Docs
- `PM documentation/` product scope, roadmap, status
- `EM documentation/` architecture, tech decisions, change log, runbook
- `Test documentation/` strategy, test report, acceptance checklist
- `supabase/migrations/` run in order (001 to 006) in the Supabase SQL editor

## Local
`npm install`, copy env names from `EM documentation/Environment and Secrets.md`, `npm run dev`. Always run `npx next build` before deploying.
