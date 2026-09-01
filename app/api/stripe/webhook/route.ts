import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const payload = await request.text();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({
      received: true,
      warning: "Webhook received but STRIPE_WEBHOOK_SECRET is not configured.",
      bytes: payload.length,
    });
  }

  return NextResponse.json({
    received: true,
    note: "Add Stripe signature verification here before enabling paid production traffic.",
    bytes: payload.length,
  });
}
