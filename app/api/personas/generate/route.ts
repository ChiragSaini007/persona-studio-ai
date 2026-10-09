import { NextRequest, NextResponse } from "next/server";
import { generateProfileWithAI } from "../../../../lib/ai";
import { bearerToken, getAuthUser } from "../../../../lib/auth";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Creator login required" }, { status: 401 });

  const { content, consent } = await request.json();

  if (consent !== true) {
    return NextResponse.json(
      { error: "The creator must confirm consent before an AI persona can be drafted from their content" },
      { status: 400 },
    );
  }

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const result = await generateProfileWithAI(content);
  return NextResponse.json(result);
}
