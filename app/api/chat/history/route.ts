import { NextRequest, NextResponse } from "next/server";
import { bearerToken, getAuthUser } from "../../../../lib/auth";
import { cleanHandle, PersonaRecord } from "../../../../lib/persona";
import { supabaseRest } from "../../../../lib/supabase-rest";

type ConversationRow = {
  id: string;
  persona_id: string;
  fan_user_id?: string | null;
  paid: boolean;
  created_at?: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "fan" | "persona";
  text: string;
  flagged: boolean;
  flag_reason?: string | null;
  created_at?: string;
};

export async function GET(request: NextRequest) {
  const user = await getAuthUser(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Fan login required" }, { status: 401 });

  const handle = cleanHandle(request.nextUrl.searchParams.get("handle") || "");
  if (!handle) return NextResponse.json({ error: "Creator handle required" }, { status: 400 });

  try {
    const personas = await supabaseRest<PersonaRecord[]>(
      `personas?creator_handle=eq.${encodeURIComponent(handle)}&select=id,creator_name,creator_handle`,
    );
    const persona = personas[0];
    if (!persona?.id) return NextResponse.json({ conversations: [] });

    const conversations = await supabaseRest<ConversationRow[]>(
      `conversations?persona_id=eq.${encodeURIComponent(persona.id)}&fan_user_id=eq.${encodeURIComponent(
        user.id,
      )}&select=id,persona_id,fan_user_id,paid,created_at&order=created_at.desc&limit=20`,
    );
    const conversationIds = conversations.map((conversation) => conversation.id);
    const messages = conversationIds.length
      ? await supabaseRest<MessageRow[]>(
          `messages?conversation_id=in.(${conversationIds.join(
            ",",
          )})&select=id,conversation_id,role,text,flagged,flag_reason,created_at&order=created_at.asc`,
        )
      : [];

    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        ...conversation,
        messages: messages
          .filter((message) => message.conversation_id === conversation.id)
          .map((message) => ({
            id: message.id,
            from: message.role,
            text: message.text,
            flagged: message.flagged,
            flagReason: message.flag_reason || undefined,
          })),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load chat history" }, { status: 500 });
  }
}
