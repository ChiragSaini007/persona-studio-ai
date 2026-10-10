import { NextRequest, NextResponse } from "next/server";
import { logAudit, requireStaff } from "../../../../../lib/admin";
import { laCreateSessionToken, laListVoices, laStartSession, liveavatarConfigured, sandboxAvatarId } from "../../../../../lib/liveavatar";

// Starts a LiveAvatar session in SANDBOX mode only. This route cannot start a paid session: is_sandbox is fixed to true.
export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  if (!liveavatarConfigured()) return NextResponse.json({ error: "LiveAvatar is not connected yet" }, { status: 400 });

  try {
    const voices = await laListVoices(100);
    const voice = voices.find((item) => item.language?.toLowerCase().startsWith("en")) || voices[0];
    const token = await laCreateSessionToken({ avatarId: sandboxAvatarId, sandbox: true, voiceId: voice?.id, language: "en", maxSeconds: 60 });
    const session = await laStartSession(token.session_token);
    await logAudit(auth.staff, "liveavatar_sandbox_started", null, { session_id: session.session_id });
    return NextResponse.json({
      sessionId: session.session_id,
      livekitUrl: session.livekit_url,
      livekitToken: session.livekit_client_token,
      voice: voice ? { name: voice.name, language: voice.language } : null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start the sandbox session" }, { status: 502 });
  }
}
