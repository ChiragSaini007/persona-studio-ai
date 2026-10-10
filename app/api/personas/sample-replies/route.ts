import { NextRequest, NextResponse } from "next/server";
import { generateSampleReplies } from "../../../../lib/ai";
import { bearerToken, getAuthUser } from "../../../../lib/auth";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Creator login required" }, { status: 401 });

  const body = await request.json();
  if (body.consent !== true) {
    return NextResponse.json({ error: "The creator must confirm consent first" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim().slice(0, 300) : "";
  if (!question) return NextResponse.json({ error: "A sample fan question is required" }, { status: 400 });

  const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
  const result = await generateSampleReplies({
    creatorName: text(body.creatorName, 120),
    bio: text(body.bio, 600),
    tone: text(body.tone, 40) || "Warm",
    length: text(body.length, 40) || "Short",
    emoji: text(body.emoji, 40) || "Some",
    content: text(body.content, 6000),
    question,
  });
  return NextResponse.json(result);
}
