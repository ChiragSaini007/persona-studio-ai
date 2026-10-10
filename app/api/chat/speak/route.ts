import { NextRequest, NextResponse } from "next/server";
import { managedAvatarBlocked } from "../../../../lib/admin";
import { bearerToken, getAuthUser } from "../../../../lib/auth";
import { PersonaRecord } from "../../../../lib/persona";
import { resolveActivePersona } from "../../../../lib/variants";
import { supabaseRest } from "../../../../lib/supabase-rest";
import { normalizeVoiceConfig, synthesizeSpeech } from "../../../../lib/tts";

type Row = { id: string; persona_id: string; fan_user_id?: string | null };

// Fan taps "Listen". Only replies that the avatar really sent, in the fan's own conversation, can be spoken.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const body = await request.json();
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(conversationId) || !text || text.length > 1500) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const conversations = await supabaseRest<Row[]>(`conversations?id=eq.${conversationId}&select=id,persona_id,fan_user_id`);
    const conversation = conversations[0];
    if (!conversation || conversation.fan_user_id !== user.id) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const personas = await supabaseRest<(PersonaRecord & { voice_config?: unknown; managed_by_admin?: boolean; approval_status?: string })[]>(
      `personas?id=eq.${conversation.persona_id}&select=*`,
    );
    const persona = personas[0];
    if (!persona || persona.status !== "live" || (await managedAvatarBlocked(persona, request))) {
      return NextResponse.json({ error: "Voice is not available" }, { status: 403 });
    }
    const { variant } = await resolveActivePersona(persona as PersonaRecord & { active_variant_id?: string | null });
    const voice = normalizeVoiceConfig(persona.voice_config);
    if (variant?.overlay.voiceInstructions) voice.instructions = `${voice.instructions} ${variant.overlay.voiceInstructions}`.slice(0, 400);
    if (!voice.enabled) return NextResponse.json({ error: "Voice replies are not enabled for this avatar" }, { status: 403 });

    const messages = await supabaseRest<{ text: string }[]>(
      `messages?conversation_id=eq.${conversationId}&role=eq.persona&select=text&order=created_at.desc&limit=100`,
    );
    if (!messages.some((message) => message.text.trim() === text)) {
      return NextResponse.json({ error: "That reply was not found" }, { status: 404 });
    }

    const audio = await synthesizeSpeech(text, voice);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not play this reply" }, { status: 500 });
  }
}
