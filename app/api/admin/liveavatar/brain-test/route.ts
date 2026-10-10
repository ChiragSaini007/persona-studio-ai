import { NextRequest, NextResponse } from "next/server";
import { logAudit, requireStaff } from "../../../../../lib/admin";
import { loadAvatar } from "../../../../../lib/admin-avatars";
import {
  laCreateLlmConfiguration,
  laCreateSecret,
  laCreateSessionToken,
  laDeleteLlmConfiguration,
  laDeleteSecret,
  laListVoices,
  laStartSession,
  liveavatarConfigured,
  sandboxAvatarId,
} from "../../../../../lib/liveavatar";
import { normalizeVideoConfig } from "../../../../../lib/video";

// Sandbox-only test where the LiveAvatar face answers with THIS avatar's brain (persona, content, limits, genre mode).
// It creates a temporary connection to our brain endpoint and removes it again when the test ends.
export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  if (!liveavatarConfigured()) return NextResponse.json({ error: "LiveAvatar is not connected yet" }, { status: 400 });
  const body = await request.json();
  const avatarId = typeof body.avatarId === "string" ? body.avatarId : "";

  let secretId = "";
  let configId = "";
  try {
    const avatar = await loadAvatar(avatarId);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    if (avatar.status !== "live" || !normalizeVideoConfig(avatar.video_config).enabled) {
      return NextResponse.json({ error: "The brain only answers for a live avatar with video switched on. Publish it and turn video on first." }, { status: 400 });
    }
    const secret = process.env.VIDEO_LLM_SECRET;
    if (!secret) return NextResponse.json({ error: "The brain secret is not set on the server" }, { status: 400 });

    secretId = await laCreateSecret(`fanline-brain-${Date.now()}`, secret);
    configId = await laCreateLlmConfiguration({
      displayName: `Fanline brain test ${new Date().toISOString().slice(0, 16)}`,
      modelName: "fanline-avatar",
      secretId,
      baseUrl: `${request.nextUrl.origin}/api/video/llm/${avatarId}`,
    });

    const voices = await laListVoices(100);
    const voice = voices.find((item) => item.language?.toLowerCase().startsWith("en")) || voices[0];
    const token = await laCreateSessionToken({ avatarId: sandboxAvatarId, sandbox: true, voiceId: voice?.id, language: "en", maxSeconds: 60, llmConfigurationId: configId });
    const session = await laStartSession(token.session_token);
    await logAudit(auth.staff, "liveavatar_brain_test_started", avatarId, { session_id: session.session_id });
    return NextResponse.json({
      sessionId: session.session_id,
      livekitUrl: session.livekit_url,
      livekitToken: session.livekit_client_token,
      voice: voice ? { name: voice.name, language: voice.language } : null,
      cleanup: { secretId, configId },
    });
  } catch (error) {
    if (configId) await laDeleteLlmConfiguration(configId);
    if (secretId) await laDeleteSecret(secretId);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start the brain test" }, { status: 502 });
  }
}
