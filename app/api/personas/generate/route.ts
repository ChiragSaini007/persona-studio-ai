import { NextRequest, NextResponse } from "next/server";
import { generateProfileWithAI } from "../../../../lib/ai";

export async function POST(request: NextRequest) {
  const { content } = await request.json();

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const result = await generateProfileWithAI(content);
  return NextResponse.json(result);
}
