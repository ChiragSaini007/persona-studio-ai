# Handoff: resume here (saved 11 Oct 2026)

Live: https://persona-studio-ai-three.vercel.app · Repo: ChiragSaini007/persona-studio-ai (main, all pushed) · Admin: /admin (ADMIN_EMAILS = owner)

## State
- Text, voice replies, real-time voice: live (per avatar, Ops switches on).
- Video: fan call page built; runs in free LiveAvatar sandbox (test face, 60 s). Real face and paid mode need LIVEAVATAR_PRODUCTION=true plus a licensed avatar id in the avatar's video settings.
- Database was wiped on 10 Oct. One avatar exists: Shah Rukh Khan (handle `shahrukhkhan`, id 2fa171c0-bb7e-4031-bee6-37a56374a872). Rights recorded from owner's offline-consent statement (IN, US). Status: submitted, awaiting admin Approve then Publish. No voice clone, no photo, video off.
- Landing/labels updated: Voice Live, Video In preview.

## Next steps (suggested order)
1. Approve and publish the SRK avatar; add the real consent document reference in the Rights tab; switch voice on and test.
2. Human test of the fan video call with a microphone.
3. Photo field on avatars (approved image from talent team).
4. Real voice: ElevenLabs-type key plus clean samples from the talent team. Hindi voice for video needs the same.
5. Real face for video: licensed footage and recorded consent, then LiveAvatar or HeyGen avatar id.
6. MCP server for brands (design agreed): `/api/mcp`, OAuth per brand, `avatar_grants` table, tools list_avatars / get_avatar_brief / chat_with_avatar / check_script, audit + metering. Decide pricing model first (per call, campaign or avatar).
7. Backlog: real Instagram connect, admin MFA/SSO, review-queue actions, voice cost caps, avatar delete route, India labelling for synthetic media.

## Housekeeping
- Rotate every key pasted in chat (HeyGen, LiveAvatar, Supabase, OpenAI). Keys live only in Vercel env; Git history was scanned and is clean.
- Always `npx next build` before commit/deploy. Migrations 001 to 006 are applied.
- Docs: README, PM/EM/Test folders (see "Real-time Video (LiveAvatar) and Brain" and "Test Report").
