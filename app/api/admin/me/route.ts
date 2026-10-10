import { NextRequest, NextResponse } from "next/server";
import { getStaff } from "../../../../lib/admin";

export async function GET(request: NextRequest) {
  const staff = await getStaff(request);
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return NextResponse.json({ email: staff.email, role: staff.role });
}
