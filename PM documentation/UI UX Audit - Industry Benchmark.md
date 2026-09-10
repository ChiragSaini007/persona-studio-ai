# Persona Studio UI/UX Audit - Industry Benchmark

## Benchmark Lens

Persona Studio is competing with three mental models:

- Meta AI Studio: guided AI creation, personality traits, knowledge areas, tone, boundaries, audience control, and creator review.
- Delphi: public expert profile, bio, suggested questions, direct creator handle URL, conversation history, usage/insight layer.
- Character.AI: fast creation, avatar, greeting, voice, tags, visibility, and example dialogue that makes the character memorable.

The current product is directionally credible, but it still feels like a prototype because the screens do not yet share one confident product system. The landing page feels editorial, creator onboarding feels administrative, and fan chat feels like a demo. The main improvement is not “make it prettier”; it is to make the product feel more real, personal, and operational.

## 1. Landing Page

Current issue:
The landing page has a strong first impression, but it still sells the idea more than the product. The portrait and big type are memorable, but the actual product proof is small. The lower sections repeat similar claims around voice, memory, safety, and control.

Industry benchmark:
Top creator-AI products show the outcome fast: creator profile, suggested questions, AI reply quality, source/provenance, and publish/share controls. Delphi foregrounds interactive profiles people can talk to. Meta AI Studio emphasizes guided creation and creator control.

Recommended improvements:

- Replace the generic proof rows with a “Creator to Fan” live product strip:
  - Creator adds source content.
  - Persona extracts voice.
  - Creator approves answer style.
  - Fan gets a natural DM reply.
- Add a visible “before/after” example:
  - Raw creator input.
  - Generated persona voice.
  - Final fan-facing answer.
- Reduce repeated giant typography below the hero.
- Add one strong final conversion section with a specific promise: “Create your first shareable AI persona in 10 minutes.”
- Make the landing page answer three questions immediately:
  - What does the creator provide?
  - What does the fan see?
  - How does the creator stay protected?

Priority: High.

## 2. Creator Sign Up / Login

Current issue:
The first screen asks for account creation, creator name, handle, permission confirmation, and then shows a disabled CTA. This creates friction before the creator feels value.

Industry benchmark:
Character.AI keeps creation fast: name, avatar, greeting, tags, visibility, publish. Meta AI Studio starts with a guided idea and then helps fill in the details.

Recommended improvements:

- Split access from persona setup:
  - Screen 1: “Continue with email” or “Sign in.”
  - Screen 2: “Who are we creating this persona for?”
- Do not show creator profile fields during login.
- Move permission/disclosure confirmation closer to publish, not the very first step.
- Replace disabled CTA with inline field-level guidance.
- Consider magic-link or OTP login later to reduce password friction.

Priority: High.

## 3. Creator Onboarding Interview

Current issue:
The onboarding is better than a raw form, but it still feels like a workflow panel rather than a premium interview. The system needs to feel like it is helping the creator shape a public voice.

Industry benchmark:
Meta AI Studio talks about guided creation doing the heavy lifting. Character.AI asks for greeting, avatar, voice, tags, and character definition. Delphi emphasizes purpose, style, knowledge, and suggested questions.

Recommended improvements:

- Make onboarding a true quiz/interview:
  - “What do fans usually ask you?”
  - “How should your AI greet people?”
  - “What topics are you comfortable answering?”
  - “Which languages can your AI reply in?”
  - “Give 3 ideal answers in your voice.”
  - “What should it never say?”
- Show one question per screen with progress.
- Keep a live fan preview beside every answer.
- Let creators skip and come back.
- Add quick chips for common creator types:
  - Founder
  - Actor
  - Athlete
  - Coach
  - Educator
  - Influencer

Priority: Very High.

## 4. Persona Review Screen

Current issue:
Review currently looks like extracted tags and phrases. It does not yet feel like a serious approval surface for a public identity.

Industry benchmark:
Creator tools need review, edit, and test loops. Character.AI encourages definitions and example dialogue. Delphi lets creators refine mind settings and purpose.

Recommended improvements:

- Change review from static chips to editable cards:
  - Public bio
  - Tone rules
  - Answer style
  - Supported languages
  - Favorite phrases
  - Never-say list
  - Example replies
- Add a “Test the persona” panel:
  - Creator asks 3 test questions.
  - AI replies.
  - Creator marks “Good / Needs edit.”
- Add an “Approval checklist” before publish:
  - Greeting reviewed.
  - Boundaries reviewed.
  - Example replies reviewed.
  - Fan disclosure reviewed.

Priority: Very High.

## 5. Safety / Boundaries

Current issue:
Safety is visible, but it feels like compliance copy. It should feel like creator control.

Industry benchmark:
Meta AI Studio explicitly talks about transparency and control: where the character is available, who can interact, and review of what it says.

Recommended improvements:

- Rename safety to “Boundaries.”
- Split into creator-friendly categories:
  - Private life
  - Medical/legal/financial advice
  - Politics
  - Brand partnerships
  - Personal DMs / meetups
  - Custom blocked topics
- Add examples:
  - “If fan asks X, AI says Y.”
- Let the creator preview refusal behavior.
- Add “flagged for review” explanation in plain language:
  - “A flagged message is a fan message that touched a blocked topic, triggered fallback, or could create reputational risk.”

Priority: High.

## 6. Publish Screen

Current issue:
Publishing works conceptually, but the live-link moment should feel more rewarding and more practical.

Industry benchmark:
Creator products optimize share moments: copy link, open public page, share to Instagram bio, Linktree, WhatsApp, broadcast channels.

Recommended improvements:

- Add a “Your fan link is ready” success state.
- Show the public page preview in-line.
- Add sharing actions:
  - Copy link
  - Open fan page
  - Copy IG bio text
  - Copy story sticker text
  - Download QR code
- Add creator controls:
  - Pause persona
  - Edit persona
  - View dashboard

Priority: Medium-High.

## 7. Fan Chat Page

Current issue:
This is now better, but still too much of the product mechanics are visible. Fans came to interact with the creator, not read a product explainer.

Industry benchmark:
Delphi public profiles show creator identity, bio, suggested questions, and then chat. Character.AI emphasizes an opening greeting that hooks the user into conversation.

Recommended improvements:

- Make creator identity the hero:
  - Avatar / portrait
  - Name
  - Short bio
  - “AI persona” disclosure in a compact badge
- Start with a natural greeting written by the creator.
- Put suggested questions above the composer or as first-message chips.
- Keep disclosure compact:
  - “AI persona based on approved public material.”
  - Expand for details.
- Do not show “approved creator context” under every message. Instead:
  - Show source/provenance only when a fan taps “Why this answer?”
- Add conversation state:
  - “Chirag is thinking…”
  - “Checking approved context…”
  - “Using current public source…” when web lookup is used.
- Add clean answer formatting:
  - Short paragraphs.
  - Bullets only when useful.
  - Links as proper hyperlinks.

Priority: Very High.

## 8. Returning Creator Dashboard

Current issue:
The dashboard needs to become the default home for repeat creators. It should feel operational, not like the onboarding flow again.

Industry benchmark:
Delphi has usage and conversation surfaces. Creator monetization tools typically focus on audience, engagement, revenue, and content insights.

Recommended improvements:

- Default repeat creators to dashboard.
- Add tabs:
  - Personas
  - Conversations
  - Review Queue
  - Insights
  - Revenue
  - Settings
- Metrics to show:
  - Conversations
  - Fan messages
  - Returning fans
  - Top questions
  - Fallback rate
  - Flagged rate
  - Most used source content
  - Revenue when paid chat is enabled
- Add persona portfolio:
  - Live / paused / draft
  - Fan link
  - Edit
  - Duplicate
  - Pause

Priority: Very High.

## 9. Mobile UX

Current issue:
The current visual direction is desktop-first. Creator and fan products will be used heavily from phones.

Industry benchmark:
Meta AI Studio, Character.AI, Instagram, and WhatsApp all train users around mobile-first chat and creation.

Recommended improvements:

- Design fan chat mobile-first.
- Keep input sticky at bottom.
- Keep disclosure as a compact top badge.
- Show suggested questions as horizontally scrollable chips.
- Creator onboarding should be one question per screen on mobile.
- Dashboard should use cards only where each card has a clear operational job.

Priority: Very High.

## 10. Product Identity System

Current issue:
The product has a palette and typography, but not yet a distinctive system.

Recommended improvements:

- Build a “creator voice” design language:
  - Portrait or avatar treatment.
  - Voice sample cards.
  - Conversation proof cards.
  - Provenance markers.
  - Approval stamps.
- Define color roles:
  - Coral: fan message / interaction.
  - Mint: AI disclosure / safe state.
  - Yellow: creator approval, not warnings.
  - Black: primary actions and serious controls.
- Reduce overuse of bold typography.
- Use calmer body text and reserve heavy type for moments that matter.

Priority: High.

## Recommended Execution Order

1. Rebuild creator onboarding as a one-question-at-a-time interview with live preview.
2. Redesign fan chat mobile-first as the core product surface.
3. Build returning creator dashboard with persona portfolio and metrics.
4. Redesign persona review as editable approval cards plus test chat.
5. Refresh landing page with stronger product proof and less repeated claims.
6. Add upload/avatar/media support so creator identity is real, not placeholder.

## Definition Of Done For A Better V1

- A new creator can create a persona without feeling like they are filling a settings form.
- A returning creator lands on a dashboard and understands what happened since last visit.
- A fan can start chatting in under 10 seconds.
- The persona answers in a natural creator voice, with compact trust indicators.
- Every screen feels like one product, not separate prototypes.
- Desktop and mobile both pass screenshot QA.
