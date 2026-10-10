import { NextRequest, NextResponse } from "next/server";
import { bearerToken, getAuthUser } from "../../../../../lib/auth";
import { findFlag, PersonaRecord } from "../../../../../lib/persona";
import { endSession, VoiceSession } from "../../../../../lib/realtime";
import { supabaseRest } from "../../../../../lib/supabase-rest";

// The fan hangs up. The server ends the call, measures the time itself, and stores the transcript for review.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = await request.json();
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const rows = await supabaseRest<VoiceSession[]>(`voice_sessions?id=eq.${sessionId}&select=*`);
    const session = rows[0];
    if (!session || session.fan_user_id !== user.id) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    await endSession(session, "fan_ended");

    const transcript = (Array.isArray(body.transcript) ? body.transcript : [])
      .slice(0, 80)
      .map((turn: { role?: string; text?: string }) => ({ role: turn.role === "avatar" ? "avatar" : "fan", text: String(turn.text || "").slice(0, 800) }))
      .filter((turn: { text: string }) => turn.text.trim());

    let flagged = 0;
    if (transcript.length) {
      const personas = await supabaseRest<PersonaRecord[]>(`personas?id=eq.${session.persona_id}&select=*`);
      if (personas[0]) {
        flagged = transcript.filter((turn: { role: string; text: string }) => turn.role === "fan" && findFlag(personas[0], turn.text)).length;
      }
    }
    await supabaseRest(`voice_sessions?id=eq.${sessionId}`, { method: "PATCH", body: { transcript, flagged_turns: flagged }, prefer: "return=minimal" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not end the call" }, { status: 500 });
  }
}
