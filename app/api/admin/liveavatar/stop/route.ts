import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../../../../../lib/admin";
import { laStopSession } from "../../../../../lib/liveavatar";

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const body = await request.json();
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  try {
    await laStopSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not stop the session" }, { status: 502 });
  }
}
