import { after, NextRequest, NextResponse } from "next/server";
import { activeAgreement, requestCountry, territoryAllows } from "../../../../lib/admin";
import { bearerToken, getAuthUser } from "../../../../lib/auth";
import { cleanHandle, PersonaRecord } from "../../../../lib/persona";
import { resolveActivePersona } from "../../../../lib/variants";
import { buildRealtimeInstructions, createRealtimeCall, endSession, realtimeLimits, VoiceSession } from "../../../../lib/realtime";
import { supabaseRest } from "../../../../lib/supabase-rest";
import { normalizeVoiceConfig } from "../../../../lib/tts";

export const maxDuration = 300;

type Persona = PersonaRecord & { voice_config?: unknown; approval_status?: string };

// A fan starts a live voice call. Every rule is checked here, on the server, before any call is created.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Please sign in to talk live." }, { status: 401 });

  const body = await request.json();
  const offer = typeof body.offer === "string" ? body.offer : "";
  if (!offer.startsWith("v=0") || offer.length > 30_000) return NextResponse.json({ error: "Invalid call request" }, { status: 400 });
  const handle = cleanHandle(typeof body.handle === "string" ? body.handle : "");

  try {
    const personas = await supabaseRest<Persona[]>(`personas?creator_handle=eq.${encodeURIComponent(handle)}&select=*`);
    const persona = personas[0];
    const voice = normalizeVoiceConfig(persona?.voice_config);
    if (!persona || persona.status !== "live" || !voice.realtime_enabled || persona.approval_status !== "approved") {
      return NextResponse.json({ error: "Live voice is not available for this avatar." }, { status: 403 });
    }
    const liveAgreement = await activeAgreement(persona.id as string, "realtime_voice");
    if (!liveAgreement) {
      return NextResponse.json({ error: "Live voice is not available for this avatar." }, { status: 403 });
    }
    if (!territoryAllows(liveAgreement, requestCountry(request))) {
      return NextResponse.json({ error: "Live voice is not available in your region yet." }, { status: 403 });
    }

    const limits = realtimeLimits();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [mine, month] = await Promise.all([
      supabaseRest<VoiceSession[]>(`voice_sessions?fan_user_id=eq.${user.id}&started_at=gte.${dayAgo}&select=*`),
      supabaseRest<{ seconds: number; max_seconds: number; status: string }[]>(`voice_sessions?started_at=gte.${monthStart}&select=seconds,max_seconds,status`),
    ]);

    // Close any call this fan left open that is past its limit.
    for (const stale of mine.filter((item) => item.status === "active" && Date.now() - new Date(item.started_at).getTime() > (item.max_seconds + 45) * 1000)) {
      await endSession(stale, "stale");
    }
    if (mine.some((item) => item.status === "active" && Date.now() - new Date(item.started_at).getTime() <= (item.max_seconds + 45) * 1000)) {
      return NextResponse.json({ error: "You already have a live call open. End it first." }, { status: 409 });
    }
    if (mine.length >= limits.dailyPerFan) {
      return NextResponse.json({ error: `You have used your ${limits.dailyPerFan} live calls for today. Try again tomorrow, or keep chatting by text.` }, { status: 429 });
    }
    const usedSeconds = month.reduce((sum, item) => sum + (item.status === "active" ? item.max_seconds : item.seconds), 0);
    if (usedSeconds / 60 >= limits.monthlyMinutes) {
      return NextResponse.json({ error: "Live voice is paused for this month. Chat is still available." }, { status: 503 });
    }

    const rows = await supabaseRest<VoiceSession[]>("voice_sessions", {
      method: "POST",
      prefer: "return=representation",
      body: { persona_id: persona.id, fan_user_id: user.id, channel: "realtime_voice", max_seconds: limits.maxSeconds },
    });
    const session = rows[0];

    let call;
    try {
      call = await createRealtimeCall(offer, buildRealtimeInstructions((await resolveActivePersona(persona as PersonaRecord & { active_variant_id?: string | null })).persona), voice.realtime_voice);
    } catch (error) {
      await endSession(session, "failed");
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start the call" }, { status: 502 });
    }
    await supabaseRest(`voice_sessions?id=eq.${session.id}`, { method: "PATCH", body: { call_id: call.callId }, prefer: "return=minimal" });

    // Safety net: even if the browser never reports back, the server hangs up when time is up.
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, (limits.maxSeconds + 10) * 1000));
      const current = await supabaseRest<VoiceSession[]>(`voice_sessions?id=eq.${session.id}&select=*`);
      if (current[0]) await endSession(current[0], "time_limit");
    });

    return NextResponse.json({ answer: call.answer, sessionId: session.id, maxSeconds: limits.maxSeconds });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start the call" }, { status: 500 });
  }
}
