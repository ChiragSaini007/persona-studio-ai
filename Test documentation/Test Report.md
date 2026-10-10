# Test Report (10 Oct 2026)

Automated: `tests/persona-runtime.test.mjs`, `tests/rendered-html.test.mjs` (run with node). Gate: `npx next build` must succeed before any commit or deploy.

Manual end-to-end on production:
| Area | Result |
|---|---|
| Admin sign-in, staff gate, audit log | Pass |
| Rights confirm, submit, approve, publish, pause | Pass |
| Territory block, example cannot publish | Pass |
| PDF/audio/text ingest | Pass |
| Genre modes in test chat | Pass |
| Voice replies and real-time voice (start, captions, hang-up, kill switch) | Pass |
| Brain endpoint: bad key 401, streamed reply, risky fallback, paused 404 | Pass |
| HeyGen wallet read ($5) | Pass |
| LiveAvatar sandbox: video 1280x720, speech, audio | Pass |
| LiveAvatar brain test: persona-correct answer, credits unchanged (10), temp secret and config removed on stop | Pass |

Known gaps: no automated tests for admin APIs or video; Hindi video voice untested; temp test avatar "Brain Test Temp" is paused (no delete route yet).
