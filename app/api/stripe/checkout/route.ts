import { NextRequest, NextResponse } from "next/server";
import { cleanHandle, PersonaRecord } from "../../../../lib/persona";
import { createCheckoutSession } from "../../../../lib/stripe";
import { supabaseRest } from "../../../../lib/supabase-rest";

export async function POST(request: NextRequest) {
  const { handle } = await request.json();
  const creatorHandle = cleanHandle(handle || "");
  const origin = request.headers.get("origin") || request.nextUrl.origin;

  try {
    const personas = await supabaseRest<PersonaRecord[]>(
      `personas?creator_handle=eq.${encodeURIComponent(creatorHandle)}&select=*`,
    );
    const persona = personas[0];
    if (!persona) return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    if (persona.status !== "live") return NextResponse.json({ error: "Persona is not live" }, { status: 403 });

    const session = await createCheckoutSession({
      handle: creatorHandle,
      creatorName: persona.creator_name,
      priceCents: persona.price_cents,
      successUrl: `${origin}/p/${creatorHandle}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/p/${creatorHandle}`,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create checkout" }, { status: 500 });
  }
}
