import { NextRequest, NextResponse } from "next/server";
import { generateChatReply, moderateText } from "../../../../lib/ai";
import { findFlag, PersonaRecord } from "../../../../lib/persona";
import { supabaseRest } from "../../../../lib/supabase-rest";

type ConversationRow = {
  id: string;
  persona_id: string;
};

type MessageRow = {
  role: "fan" | "persona";
  text: string;
  created_at?: string;
};

export async function POST(request: NextRequest) {
  const { conversationId, message } = await request.json();

  if (!conversationId || !message) {
    return NextResponse.json({ error: "conversationId and message are required" }, { status: 400 });
  }

  try {
    const conversations = await supabaseRest<ConversationRow[]>(
      `conversations?id=eq.${encodeURIComponent(conversationId)}&select=*`,
    );
    const conversation = conversations[0];
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const personas = await supabaseRest<PersonaRecord[]>(
      `personas?id=eq.${encodeURIComponent(conversation.persona_id)}&select=*`,
    );
    const persona = personas[0];
    if (!persona || persona.status !== "live") {
      return NextResponse.json({ error: "Persona is not available" }, { status: 403 });
    }

    const guardrailFlag = findFlag(persona, message);
    const moderationFlag = await moderateText(message);
    const flagReason = guardrailFlag || moderationFlag;
    const history = await supabaseRest<MessageRow[]>(
      `messages?conversation_id=eq.${encodeURIComponent(conversation.id)}&select=role,text,created_at&order=created_at.asc&limit=12`,
    );
    const { reply, usedAI, runtimeError } = await generateChatReply(persona, message, flagReason, history);
    if (runtimeError) console.error("Persona chat runtime failed", runtimeError);

    const savedMessages = await supabaseRest("messages", {
      method: "POST",
      body: [
        {
          conversation_id: conversation.id,
          role: "fan",
          text: message,
          flagged: Boolean(flagReason),
          flag_reason: flagReason || null,
        },
        {
          conversation_id: conversation.id,
          role: "persona",
          text: reply,
          flagged: Boolean(flagReason),
          flag_reason: flagReason || null,
        },
      ],
      prefer: "return=representation",
    });

    return NextResponse.json({ reply, flagReason, usedAI, runtimeError, messages: savedMessages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send message" }, { status: 500 });
  }
}
