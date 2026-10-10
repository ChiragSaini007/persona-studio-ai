import { guardrails, normalizeProfile, PersonaRecord } from "./persona";
import { supabaseRest } from "./supabase-rest";

// Live voice calls over OpenAI Realtime (WebRTC). Our server brokers the call so we always know the call id,
// which lets us hang up any call: on a time limit, when an avatar is paused, or from the admin kill switch.

export function realtimeLimits() {
  // The safety hang-up timer runs inside one Vercel function (max 300s), so the cap cannot exceed 270s.
  const maxSeconds = Math.min(270, Math.max(30, Number(process.env.REALTIME_MAX_SECONDS) || 240));
  return {
    maxSeconds,
    dailyPerFan: Number(process.env.REALTIME_DAILY_PER_FAN) || 3,
    monthlyMinutes: Number(process.env.REALTIME_MONTHLY_MINUTES) || 300,
  };
}

export function buildRealtimeInstructions(persona: PersonaRecord, options: { channel?: "voice" | "video"; opening?: boolean } = {}) {
  const channel = options.channel || "voice";
  const opening = options.opening !== false;
  const profile = normalizeProfile(persona.profile, persona.source_content);
  const first = persona.creator_name.trim().split(/\s+/)[0] || "the creator";
  const blocked = guardrails.filter((rail) => rail.locked || persona.enabled_guardrails?.[rail.key]).map((rail) => rail.title.toLowerCase());
  const custom = (persona.custom_boundary || "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  const grounding = (profile.retrievalChunks.length ? profile.retrievalChunks.join("\n\n") : persona.source_content).slice(0, 3500);

  return [
    `You are the AI avatar of ${persona.creator_name}, on a live ${channel} call with a fan. You are NOT the real ${first}.`,
    opening
      ? `Open the call by saying, in your own words: you are ${first}'s AI avatar, not the real ${first}, then give a short warm greeting. Never claim to be the real person, to have real-time personal access, or to know private facts.`
      : `Never claim to be the real person, to have real-time personal access, or to know private facts. If asked, say plainly that you are ${first}'s AI avatar.`,
    `Speak the language the fan speaks. You are comfortable in: ${profile.supportedLanguages.join(", ") || "English"}. If the fan mixes Hindi and English, mix naturally too.`,
    `This is a live ${channel} call and your words are spoken aloud: keep turns short, one to three sentences, natural and conversational. No lists, no markdown, no emoji.`,
    `Style: ${profile.responseStyle || "Warm, friendly and direct."} Tone: ${profile.tone.join(", ") || "warm"}.`,
    profile.bio ? `About ${first}: ${profile.bio}` : "",
    profile.topics.length ? `Topics ${first} is known for: ${profile.topics.join(", ")}.` : "",
    `Never discuss or give advice on: ${[...new Set([...blocked, ...custom.map((item) => item.toLowerCase())])].join(", ")}.`,
    profile.neverSay.length ? `Never say or imply: ${profile.neverSay.join(" | ")}.` : "",
    `If asked about anything off limits, politely step back with something like: "${persona.fallback_text}" Then offer to talk about something else.`,
    `Answer only from what ${first} has approved below. If you do not know, say so briefly rather than guessing.`,
    `If the fan says goodbye or wants to stop, wrap up warmly in one sentence.`,
    `Approved material:\n${grounding}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createRealtimeCall(offerSdp: string, instructions: string, voice: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Live voice needs an OpenAI key");
  const form = new FormData();
  form.append("sdp", offerSdp);
  form.append(
    "session",
    JSON.stringify({
      type: "realtime",
      model: "gpt-realtime",
      instructions,
      max_output_tokens: 300,
      audio: {
        output: { voice },
        input: { transcription: { model: "gpt-4o-mini-transcribe" }, turn_detection: { type: "semantic_vad" } },
      },
    }),
  );
  const response = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!response.ok) throw new Error(`Could not start the call (${response.status}) ${(await response.text()).slice(0, 200)}`);
  const callId = (response.headers.get("location") || "").split("/").pop() || "";
  return { answer: await response.text(), callId };
}

export async function hangupCall(callId: string | null | undefined) {
  if (!callId || !process.env.OPENAI_API_KEY) return;
  try {
    await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
  } catch {
    // best effort: the call also ends when the browser disconnects
  }
}

export type VoiceSession = {
  id: string;
  persona_id: string;
  fan_user_id: string;
  call_id: string | null;
  status: "active" | "ended";
  started_at: string;
  ended_at: string | null;
  seconds: number;
  max_seconds: number;
  ended_reason: string | null;
  transcript: { role: string; text: string }[];
  flagged_turns: number;
};

export async function endSession(session: VoiceSession, reason: string) {
  if (session.status !== "active") return;
  await hangupCall(session.call_id);
  const seconds = Math.min(session.max_seconds + 30, Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)));
  await supabaseRest(`voice_sessions?id=eq.${session.id}&status=eq.active`, {
    method: "PATCH",
    body: { status: "ended", ended_at: new Date().toISOString(), seconds, ended_reason: reason },
    prefer: "return=minimal",
  });
}

// Used by pause, revoke and the admin kill switch. Safe to call when the table does not exist yet.
export async function endActiveSessions(personaId: string, reason: string) {
  try {
    const active = await supabaseRest<VoiceSession[]>(`voice_sessions?persona_id=eq.${personaId}&status=eq.active&select=*`);
    await Promise.all(active.map((session) => endSession(session, reason)));
    return active.length;
  } catch {
    return 0;
  }
}
