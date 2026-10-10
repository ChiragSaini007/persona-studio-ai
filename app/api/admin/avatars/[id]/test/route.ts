import { NextRequest, NextResponse } from "next/server";
import { generateChatReply } from "../../../../../../lib/ai";
import { adminError, requireStaff } from "../../../../../../lib/admin";
import { loadAvatar } from "../../../../../../lib/admin-avatars";
import { findFlag } from "../../../../../../lib/persona";

type Context = { params: Promise<{ id: string }> };

// Staff test chat. Talks to the avatar as a fan would, without saving anything.
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await request.json();
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    const history = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .map((turn: { role?: string; text?: string }) => ({
            role: turn.role === "persona" ? ("persona" as const) : ("fan" as const),
            text: String(turn.text || "").slice(0, 1000),
          }))
      : [];
    const flag = findFlag(avatar, message);
    const result = await generateChatReply(avatar, message, flag, history);
    return NextResponse.json({ reply: result.reply, flagged: flag || null, used_ai: result.usedAI });
  } catch (error) {
    return adminError(error);
  }
}
