import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../../../../../lib/admin";
import { laDeleteLlmConfiguration, laDeleteSecret, laStopSession } from "../../../../../lib/liveavatar";

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const body = await request.json();
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  const idOrEmpty = (value: unknown) => (typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : "");
  try {
    await laStopSession(sessionId).catch(() => undefined);
    const cleanup = body.cleanup || {};
    if (idOrEmpty(cleanup.configId)) await laDeleteLlmConfiguration(idOrEmpty(cleanup.configId));
    if (idOrEmpty(cleanup.secretId)) await laDeleteSecret(idOrEmpty(cleanup.secretId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not stop the session" }, { status: 502 });
  }
}
