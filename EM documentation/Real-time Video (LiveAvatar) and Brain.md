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

## Fan video call (added 10 Oct 2026)
- `POST /api/video/session` (fan token): checks live, video on, not example, and for managed avatars approved + rights + territory; one open call per fan; `VIDEO_DAILY_PER_FAN`; `VIDEO_MONTHLY_MINUTES`; max `VIDEO_MAX_SECONDS`. Creates a `voice_sessions` row (`channel=realtime_video`), a temporary secret and LLM configuration, and a LiveAvatar session. `call_id` stores `session|config|secret`; `endSession` stops the session and deletes both. Server safety hang-up after `maxSeconds + 10`.
- Spend safety: sandbox (free, 60 s, public test face) unless `LIVEAVATAR_PRODUCTION=true` AND the avatar's `video_config.replica_id` holds its own LiveAvatar avatar id. Fans in sandbox see "preview face".
- End/transcript: reuses `/api/voice/session/end`. Kill switch and pause already end video calls (shared `endSession`).
- UI: `components/live-video-call.tsx` on `/p/[handle]` when `video_enabled`. Consent tick, permanent "AI avatar" badge, first spoken line says it is an AI, mute, end, countdown, captions.
- Tested 10 Oct: no token 401; example avatar 403; start 200 (preview, 60 s); second call 409; end 200; credits stayed 10. Mic-based conversation not tested (no mic in automation).
