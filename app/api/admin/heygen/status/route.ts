import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../../../../../lib/admin";
import { heygenBudget, heygenConfigured, heygenWallet } from "../../../../../lib/heygen";

// Free read-only check: is HeyGen connected, and what is left in the wallet.
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  if (!heygenConfigured()) return NextResponse.json({ connected: false });
  try {
    const wallet = await heygenWallet();
    return NextResponse.json({ connected: true, ...wallet, budget: heygenBudget() });
  } catch {
    return NextResponse.json({ connected: false, error: "HeyGen did not accept the key" });
  }
}
