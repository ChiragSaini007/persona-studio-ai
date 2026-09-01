import { NextRequest, NextResponse } from "next/server";
import { cleanHandle, PersonaRecord } from "../../../../lib/persona";
import { supabaseRest } from "../../../../lib/supabase-rest";

type ConversationRow = {
  id: string;
  persona_id: string;
  paid: boolean;
};

export async function POST(request: NextRequest) {
  const { handle, paid = false, stripe_session_id } = await request.json();
  const creatorHandle = cleanHandle(handle || "");

  try {
    const personas = await supabaseRest<PersonaRecord[]>(
      `personas?creator_handle=eq.${encodeURIComponent(creatorHandle)}&select=*`,
    );
    const persona = personas[0];

    if (!persona) return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    if (persona.status !== "live") return NextResponse.json({ error: "Persona is not live" }, { status: 403 });
    if (persona.monetization === "pay_per_conversation" && !paid) {
      return NextResponse.json({ requiresPayment: true, price_cents: persona.price_cents }, { status: 402 });
    }

    const rows = await supabaseRest<ConversationRow[]>("conversations", {
      method: "POST",
      body: {
        persona_id: persona.id,
        paid: Boolean(paid),
        stripe_session_id: stripe_session_id || null,
      },
      prefer: "return=representation",
    });

    return NextResponse.json({ conversation: rows[0], persona });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start chat" }, { status: 500 });
  }
}
