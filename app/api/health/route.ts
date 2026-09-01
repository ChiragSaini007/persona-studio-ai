import { NextResponse } from "next/server";
import { hasOpenAIConfig } from "../../../lib/ai";
import { hasSupabaseConfig } from "../../../lib/supabase-rest";

export async function GET() {
  return NextResponse.json({
    ok: true,
    supabase: hasSupabaseConfig(),
    openai: hasOpenAIConfig(),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  });
}
