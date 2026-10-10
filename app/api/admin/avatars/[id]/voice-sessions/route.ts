import { NextRequest, NextResponse } from "next/server";
import { adminError, logAudit, requireStaff } from "../../../../../../lib/admin";
import { uuidPattern } from "../../../../../../lib/admin-avatars";
import { endActiveSessions, VoiceSession } from "../../../../../../lib/realtime";
import { supabaseRest } from "../../../../../../lib/supabase-rest";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const sessions = await supabaseRest<VoiceSession[]>(`voice_sessions?persona_id=eq.${id}&select=*&order=started_at.desc&limit=30`);
    return NextResponse.json({ sessions: sessions.map((item) => ({ ...item, fan_user_id: item.fan_user_id.slice(0, 8) })) });
  } catch (error) {
    return adminError(error);
  }
}

// Kill switch: hangs up every live call for this avatar right now. Any staff member can use it.
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();
  if (body.action !== "end_all") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const ended = await endActiveSessions(id, "admin");
    await logAudit(auth.staff, "live_calls_ended", id, { ended });
    return NextResponse.json({ ended });
  } catch (error) {
    return adminError(error);
  }
}
