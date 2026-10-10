import { after, NextRequest, NextResponse } from "next/server";
import { requestCountry, rightsConfirmed, territoryAllows } from "../../../../lib/admin";
import { bearerToken, getAuthUser } from "../../../../lib/auth";
import {
  laCreateLlmConfiguration,
  laCreateSecret,
  laCreateSessionToken,
  laDeleteLlmConfiguration,
  laDeleteSecret,
  laListVoices,
  laStartSession,
  laStopSession,
  liveavatarConfigured,
  sandboxAvatarId,
} from "../../../../lib/liveavatar";
import { cleanHandle, PersonaRecord } from "../../../../lib/persona";
import { endSession, VoiceSession } from "../../../../lib/realtime";
import { supabaseRest } from "../../../../lib/supabase-rest";
import { normalizeVideoConfig, videoLimits } from "../../../../lib/video";

export const maxDuration = 300;

type Persona = PersonaRecord & { video_config?: unknown; approval_status?: string; rights_confirmed_at?: string | null; territories?: string[] | null; is_example?: boolean };

// A fan starts a live video call. Every rule is checked here, on the server, before any provider session is created.
// Spend safety: unless LIVEAVATAR_PRODUCTION is "true" AND the avatar has its own provider face, this only ever starts a free sandbox preview.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Please sign in to start a video call." }, { status: 401 });
  if (!liveavatarConfigured()) return NextResponse.json({ error: "Video calls are not available yet." }, { status: 503 });

  const body = await request.json();
  const handle = cleanHandle(typeof body.handle === "string" ? body.handle : "");
  const unavailable = (message = "Video calls are not available for this avatar.", status = 403) => NextResponse.json({ error: message }, { status });

  let secretId = "";
  let configId = "";
  let providerSessionId = "";
  let rowId = "";
  try {
    const personas = await supabaseRest<Persona[]>(`personas?creator_handle=eq.${encodeURIComponent(handle)}&select=*`);
    const persona = personas[0];
    const video = normalizeVideoConfig(persona?.video_config);
    if (!persona || persona.is_example || persona.status !== "live" || !video.enabled) return unavailable();
    if (persona.managed_by_admin) {
      if (persona.approval_status !== "approved" || !rightsConfirmed(persona)) return unavailable();
      if (!territoryAllows(persona.territories, requestCountry(request))) return unavailable("Video calls are not available in your region yet.");
    }
    const secret = process.env.VIDEO_LLM_SECRET;
    if (!secret || secret.length < 24) return unavailable("Video calls are not available yet.", 503);

    const limits = videoLimits();
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [mine, month] = await Promise.all([
      supabaseRest<VoiceSession[]>(`voice_sessions?channel=eq.realtime_video&fan_user_id=eq.${user.id}&started_at=gte.${dayAgo}&select=*`),
      supabaseRest<{ seconds: number; max_seconds: number; status: string }[]>(`voice_sessions?channel=eq.realtime_video&started_at=gte.${monthStart}&select=seconds,max_seconds,status`),
    ]);
    for (const stale of mine.filter((item) => item.status === "active" && Date.now() - new Date(item.started_at).getTime() > (item.max_seconds + 45) * 1000)) {
      await endSession(stale, "stale");
    }
    if (mine.some((item) => item.status === "active" && Date.now() - new Date(item.started_at).getTime() <= (item.max_seconds + 45) * 1000)) {
      return NextResponse.json({ error: "You already have a video call open. End it first." }, { status: 409 });
    }
    if (mine.length >= limits.dailyPerFan) {
      return NextResponse.json({ error: `You have used your ${limits.dailyPerFan} video calls for today. Try again tomorrow, or keep chatting by text.` }, { status: 429 });
    }
    const usedSeconds = month.reduce((sum, item) => sum + (item.status === "active" ? item.max_seconds : item.seconds), 0);
    if (usedSeconds / 60 >= limits.monthlyMinutes) {
      return NextResponse.json({ error: "Video calls are paused for this month. Chat is still available." }, { status: 503 });
    }

    const production = process.env.LIVEAVATAR_PRODUCTION === "true" && Boolean(video.replica_id);
    const maxSeconds = production ? limits.maxSeconds : Math.min(60, limits.maxSeconds);

    const rows = await supabaseRest<VoiceSession[]>("voice_sessions", {
      method: "POST",
      prefer: "return=representation",
      body: { persona_id: persona.id, fan_user_id: user.id, channel: "realtime_video", max_seconds: maxSeconds },
    });
    const session = rows[0];
    rowId = session.id;

    secretId = await laCreateSecret(`fanline-call-${session.id.slice(0, 8)}`, secret);
    configId = await laCreateLlmConfiguration({
      displayName: `Fanline call ${session.id.slice(0, 8)}`,
      modelName: "fanline-avatar",
      secretId,
      baseUrl: `${request.nextUrl.origin}/api/video/llm/${persona.id}`,
    });
    const voices = await laListVoices(100);
    const voice = voices.find((item) => item.language?.toLowerCase().startsWith("en")) || voices[0];
    const token = await laCreateSessionToken({
      avatarId: production ? video.replica_id : sandboxAvatarId,
      sandbox: !production,
      voiceId: voice?.id,
      language: "en",
      maxSeconds,
      llmConfigurationId: configId,
    });
    const started = await laStartSession(token.session_token);
    providerSessionId = started.session_id;
    await supabaseRest(`voice_sessions?id=eq.${session.id}`, { method: "PATCH", body: { call_id: `${providerSessionId}|${configId}|${secretId}` }, prefer: "return=minimal" });

    // Safety net: even if the browser never reports back, the server ends the call when time is up.
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, (maxSeconds + 10) * 1000));
      const current = await supabaseRest<VoiceSession[]>(`voice_sessions?id=eq.${session.id}&select=*`);
      if (current[0]) await endSession(current[0], "time_limit");
    });

    return NextResponse.json({
      sessionId: session.id,
      livekitUrl: started.livekit_url,
      livekitToken: started.livekit_client_token,
      maxSeconds,
      preview: !production,
    });
  } catch (error) {
    if (providerSessionId) await laStopSession(providerSessionId).catch(() => undefined);
    if (configId) await laDeleteLlmConfiguration(configId);
    if (secretId) await laDeleteSecret(secretId);
    if (rowId) await supabaseRest(`voice_sessions?id=eq.${rowId}`, { method: "PATCH", body: { status: "ended", ended_at: new Date().toISOString(), ended_reason: "failed" }, prefer: "return=minimal" }).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start the video call" }, { status: 502 });
  }
}
