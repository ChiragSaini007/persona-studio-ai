import { NextRequest, NextResponse } from "next/server";
import { bearerToken, getAuthUser } from "../../../lib/auth";
import { cleanHandle, PersonaRecord } from "../../../lib/persona";
import { supabaseRest } from "../../../lib/supabase-rest";

export async function GET(request: NextRequest) {
  const wantsOwnPersona = request.nextUrl.searchParams.get("mine") === "true";

  if (wantsOwnPersona) {
    const user = await getAuthUser(bearerToken(request));
    if (!user) return NextResponse.json({ error: "Creator login required" }, { status: 401 });

    try {
      const personas = await supabaseRest<PersonaRecord[]>(
        `personas?creator_user_id=eq.${encodeURIComponent(user.id)}&select=*&order=updated_at.desc&limit=1`,
      );
      const persona = personas[0];
      if (!persona?.id) return NextResponse.json({ persona: null, metrics: null });

      const conversations = await supabaseRest<{ id: string; paid: boolean }[]>(
        `conversations?persona_id=eq.${encodeURIComponent(persona.id)}&select=id,paid`,
      );
      const conversationIds = conversations.map((conversation) => conversation.id);
      const messages = conversationIds.length
        ? await supabaseRest<{ id: string; role: string; flagged: boolean }[]>(
            `messages?conversation_id=in.(${conversationIds.join(",")})&select=id,role,flagged`,
          )
        : [];
      const fanMessages = messages.filter((message) => message.role === "fan");
      const flagged = messages.filter((message) => message.flagged);

      return NextResponse.json({
        persona,
        metrics: {
          conversations: conversations.length,
          fanMessages: fanMessages.length,
          flagged: flagged.length,
          fallbackRate: fanMessages.length ? Math.round((flagged.length / fanMessages.length) * 100) : 0,
          revenue: 0,
        },
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load persona" }, { status: 500 });
    }
  }

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
  const user = await getAuthUser(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Creator login required" }, { status: 401 });

  const body = await request.json();
  const persona: PersonaRecord = {
    creator_user_id: user.id,
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
    const existing = await supabaseRest<PersonaRecord[]>(
      `personas?creator_handle=eq.${encodeURIComponent(persona.creator_handle)}&select=id,creator_user_id`,
    );
    if (existing[0]?.creator_user_id && existing[0].creator_user_id !== user.id) {
      return NextResponse.json({ error: "This handle belongs to another creator account" }, { status: 403 });
    }

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
