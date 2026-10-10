import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../../../../../lib/admin";
import { laCredits, liveavatarConfigured } from "../../../../../lib/liveavatar";

// Free read-only check: is LiveAvatar connected, and how many credits remain.
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  if (!liveavatarConfigured()) return NextResponse.json({ connected: false });
  try {
    return NextResponse.json({ connected: true, credits: await laCredits() });
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : "LiveAvatar did not accept the key" });
  }
}
