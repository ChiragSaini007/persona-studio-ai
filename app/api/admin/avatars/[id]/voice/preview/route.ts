import { NextRequest, NextResponse } from "next/server";
import { adminError, requireStaff } from "../../../../../../../lib/admin";
import { loadAvatar } from "../../../../../../../lib/admin-avatars";
import { normalizeVoiceConfig, synthesizeSpeech } from "../../../../../../../lib/tts";

type Context = { params: Promise<{ id: string }> };

// Staff preview of a voice setting. Nothing is saved.
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await request.json();

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    const config = normalizeVoiceConfig(body.voice_config);
    const text =
      (typeof body.text === "string" && body.text.trim().slice(0, 400)) ||
      avatar.profile.greetingStyle ||
      `Hi, I am ${avatar.creator_name}'s AI avatar. Ask me anything.`;
    const audio = await synthesizeSpeech(text, config);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    return adminError(error);
  }
}
