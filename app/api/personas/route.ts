import { NextRequest, NextResponse } from "next/server";
import { cleanHandle, PersonaRecord } from "../../../lib/persona";
import { supabaseRest } from "../../../lib/supabase-rest";

export async function GET(request: NextRequest) {
  const handle = cleanHandle(request.nextUrl.searchParams.get("handle") || "");

  try {
    const rows = await supabaseRest<PersonaRecord[]>(
      `personas?creator_handle=eq.${encodeURIComponent(handle)}&select=*`,
    );

    if (!rows[0]) return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    return NextResponse.json({ persona: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load persona" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const persona: PersonaRecord = {
    creator_name: body.creator_name,
    creator_handle: cleanHandle(body.creator_handle),
    source_content: body.source_content || "",
    profile: body.profile,
    enabled_guardrails: body.enabled_guardrails || {},
    custom_boundary: body.custom_boundary || "",
    fallback_text: body.fallback_text,
    monetization: body.monetization || "free",
    price_cents: Number(body.price_cents || 0),
    status: body.status || "draft",
  };

  try {
    const rows = await supabaseRest<PersonaRecord[]>("personas?on_conflict=creator_handle", {
      method: "POST",
      body: persona,
      prefer: "resolution=merge-duplicates,return=representation",
    });

    return NextResponse.json({ persona: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save persona" }, { status: 500 });
  }
}
