export function hasStripeConfig() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function createCheckoutSession(input: {
  handle: string;
  creatorName: string;
  priceCents: number;
  successUrl: string;
  cancelUrl: string;
}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY.");
  }

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", process.env.STRIPE_CURRENCY || "usd");
  body.set("line_items[0][price_data][unit_amount]", String(input.priceCents));
  body.set("line_items[0][price_data][product_data][name]", `${input.creatorName} AI persona chat`);
  body.set("metadata[creator_handle]", input.handle);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Stripe checkout failed: ${await response.text()}`);
  }

  return response.json();
}
