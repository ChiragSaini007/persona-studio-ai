import { NextRequest, NextResponse } from "next/server";
import { adminError, requireStaff } from "../../../../lib/admin";
import { supabaseRest } from "../../../../lib/supabase-rest";

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request, "admin");
  if (auth.error) return auth.error;
  try {
    const entries = await supabaseRest<unknown[]>("admin_audit_log?select=*&order=created_at.desc&limit=200");
    return NextResponse.json({ entries });
  } catch (error) {
    return adminError(error);
  }
}
