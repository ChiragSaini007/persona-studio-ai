# Real-time video: LiveAvatar and the avatar brain

## Architecture
Face and voice come from LiveAvatar (api.liveavatar.com, FULL mode, LiveKit room). The words come from our own OpenAI-compatible endpoint so video uses the same persona, content, limits and genre mode as chat and voice.

- `lib/liveavatar.ts`: credits, voices, session token, start/stop, plus temporary secret and LLM-configuration helpers.
- `/api/admin/liveavatar/status|sandbox|brain-test|stop`: admin-only. Sandbox is hard-coded `is_sandbox:true` (no credits, about 60 s, public test avatar).
- `/api/admin/liveavatar/brain-test`: creates a temporary secret (type `OPENAI_API_KEY`; only accepted types are OPENAI/ELEVENLABS/GEMINI/FISH/CARTESIA) and an LLM configuration whose `base_url` is `/api/video/llm/<avatarId>`, then starts a sandbox session using it. `stop` deletes both.
- `/api/video/llm/[id]/chat/completions` (and the base route): bearer `VIDEO_LLM_SECRET` (timing-safe); avatar must be live, video-enabled, and for managed avatars approved with rights. Risky questions return the fallback text. Replies stream from `gpt-4.1-mini`.
- Client: `components/live-avatar-sandbox.tsx` (livekit-client). Needs: no background video pause, wait for 2 remote participants, commands on topic `agent-control`: `avatar.speak_text` (fixed words) or `avatar.speak_response` (brain answers).

## Verified 10 Oct 2026
Sandbox session with brain: asked "I am a total beginner. Where should I start?"; avatar answered from the test persona ("three short walks a week... small steps, every day"). LiveAvatar credits stayed at 10.

## Gotchas
- LiveAvatar built-in voices are English only; Hindi needs a third-party voice binding.
- LiveAvatar secrets API accepts only provider-named secret types.
- JS tool in Chrome automation blocks token output; mic is unavailable in automation.

## Operations
Rotate `VIDEO_LLM_SECRET` with `vercel env rm` then `vercel env add --sensitive`. Rotate every key that was pasted in chat (HeyGen, LiveAvatar, Supabase, OpenAI) after testing.
