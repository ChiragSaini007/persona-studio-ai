import { NextRequest, NextResponse } from "next/server";
import { savePersonaEmbeddings } from "../../../lib/ai";
import { bearerToken, getAuthUser } from "../../../lib/auth";
import { buildRetrievalChunks, cleanHandle, normalizeProfile, PersonaRecord } from "../../../lib/persona";
import { supabaseRest } from "../../../lib/supabase-rest";

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  text: string;
  flagged: boolean;
  flag_reason?: string | null;
  created_at?: string;
};

type ConversationRow = {
  id: string;
  persona_id: string;
  fan_user_id?: string | null;
  paid: boolean;
  created_at?: string;
};

export async function GET(request: NextRequest) {
  const wantsOwnPersona = request.nextUrl.searchParams.get("mine") === "true";

  if (wantsOwnPersona) {
    const user = await getAuthUser(bearerToken(request));
    if (!user) return NextResponse.json({ error: "Creator login required" }, { status: 401 });

    try {
      const personas = await supabaseRest<PersonaRecord[]>(
        `personas?creator_user_id=eq.${encodeURIComponent(user.id)}&select=*&order=updated_at.desc`,
      );
      const persona = personas[0];
      if (!persona?.id) return NextResponse.json({ persona: null, personas: [], metrics: null, metricsByPersona: {}, reviewQueue: [] });

      const personaIds = personas.map((item) => item.id).filter(Boolean) as string[];
      const conversations = personaIds.length
        ? await supabaseRest<ConversationRow[]>(
            `conversations?persona_id=in.(${personaIds.join(",")})&select=id,persona_id,fan_user_id,paid,created_at&order=created_at.desc`,
          )
        : [];
      const conversationIds = conversations.map((conversation) => conversation.id);
      const messages = conversationIds.length
        ? await supabaseRest<MessageRow[]>(
            `messages?conversation_id=in.(${conversationIds.join(",")})&select=id,conversation_id,role,text,flagged,flag_reason,created_at&order=created_at.desc`,
          )
        : [];
      const metricsByPersona = Object.fromEntries(
        personas.map((item) => {
          const personaConversations = conversations.filter((conversation) => conversation.persona_id === item.id);
          const ids = new Set(personaConversations.map((conversation) => conversation.id));
          const personaMessages = messages.filter((message) => ids.has(message.conversation_id));
          const fanMessages = personaMessages.filter((message) => message.role === "fan");
          const flagged = personaMessages.filter((message) => message.flagged);
          return [
            item.id,
            {
              conversations: personaConversations.length,
              fanMessages: fanMessages.length,
              flagged: flagged.length,
              fallbackRate: fanMessages.length ? Math.round((flagged.length / fanMessages.length) * 100) : 0,
              revenue: 0,
            },
          ];
        }),
      );
      const activeMetrics = persona.id ? metricsByPersona[persona.id] : null;
      const reviewQueue = messages
        .filter((message) => message.flagged)
        .slice(0, 25)
        .map((message) => {
          const conversation = conversations.find((item) => item.id === message.conversation_id);
          const flaggedPersona = personas.find((item) => item.id === conversation?.persona_id);
          return {
            id: message.id,
            conversationId: message.conversation_id,
            personaId: conversation?.persona_id,
            personaName: flaggedPersona?.creator_name || "Persona",
            text: message.text,
            reason: message.flag_reason || "Fallback",
            createdAt: message.created_at,
          };
        });

      return NextResponse.json({
        persona,
        personas,
        metrics: activeMetrics,
        metricsByPersona,
        reviewQueue,
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
  const sourceContent = body.source_content || "";
  const profile = {
    ...normalizeProfile(body.profile, sourceContent),
    retrievalChunks: buildRetrievalChunks(sourceContent),
  };
  const persona: PersonaRecord = {
    creator_user_id: user.id,
    creator_name: body.creator_name,
    creator_handle: cleanHandle(body.creator_handle),
    source_content: sourceContent,
    profile,
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

    const savedPersona = rows[0];
    if (savedPersona) await savePersonaEmbeddings(savedPersona);
    return NextResponse.json({ persona: savedPersona });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save persona" }, { status: 500 });
  }
}
