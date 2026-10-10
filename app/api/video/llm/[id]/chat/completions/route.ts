import { NextRequest, NextResponse } from "next/server";
import { moderateText } from "../../../../../../../lib/ai";
import { loadAvatar } from "../../../../../../../lib/admin-avatars";
import { findFlag } from "../../../../../../../lib/persona";
import { buildRealtimeInstructions } from "../../../../../../../lib/realtime";
import { resolveActivePersona } from "../../../../../../../lib/variants";
import { brainSecretOk, normalizeVideoConfig } from "../../../../../../../lib/video";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };
type ChatMessage = { role: string; content: unknown };

const textOf = (content: unknown) =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : "")).join(" ")
      : "";

function sse(chunks: string[]) {
  const id = `chatcmpl-${Date.now()}`;
  const frame = (delta: Record<string, unknown>, finish: string | null) =>
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "fanline-avatar", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
  const body = [frame({ role: "assistant", content: chunks[0] }, null), ...chunks.slice(1).map((chunk) => frame({ content: chunk }, null)), frame({}, "stop"), "data: [DONE]\n\n"].join("");
  return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}

// An OpenAI-compatible chat endpoint. A video provider points its "custom LLM" setting at
// https://<site>/api/video/llm/<avatar id> so the video face speaks with our persona, content and boundaries.
export async function POST(request: NextRequest, context: Context) {
  if (!brainSecretOk(request)) return NextResponse.json({ error: { message: "Invalid API key" } }, { status: 401 });
  const { id } = await context.params;

  try {
    const avatar = await loadAvatar(id);
    if (!avatar || avatar.status !== "live") return NextResponse.json({ error: { message: "Avatar not available" } }, { status: 404 });
    if (!normalizeVideoConfig(avatar.video_config).enabled) return NextResponse.json({ error: { message: "Video is not enabled for this avatar" } }, { status: 403 });
    if (avatar.managed_by_admin && (avatar.approval_status !== "approved" || !avatar.rights_confirmed_at)) {
      return NextResponse.json({ error: { message: "Avatar not available" } }, { status: 403 });
    }

    const body = await request.json();
    const stream = body.stream !== false;
    const turns = (Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [])
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role as "user" | "assistant", content: textOf(message.content).slice(0, 1500) }))
      .filter((message) => message.content.trim())
      .slice(-12);
    const lastUser = [...turns].reverse().find((turn) => turn.role === "user")?.content || "";
    if (!lastUser) return NextResponse.json({ error: { message: "No user message" } }, { status: 400 });

    const { persona } = await resolveActivePersona(avatar);
    const flag = findFlag(persona, lastUser) || (await moderateText(lastUser));
    if (flag) {
      const reply = persona.fallback_text;
      return stream
        ? sse([reply])
        : NextResponse.json({ id: "chatcmpl-fallback", object: "chat.completion", model: "fanline-avatar", choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }] });
    }

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.VIDEO_LLM_MODEL || "gpt-4.1-mini",
        stream,
        max_tokens: 220,
        temperature: 0.7,
        messages: [{ role: "system", content: buildRealtimeInstructions(persona, { channel: "video", opening: false }) }, ...turns],
      }),
    });
    if (!upstream.ok) return NextResponse.json({ error: { message: "The avatar could not answer right now" } }, { status: 502 });
    if (stream) return new Response(upstream.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
    return NextResponse.json(await upstream.json());
  } catch {
    return NextResponse.json({ error: { message: "The avatar could not answer right now" } }, { status: 500 });
  }
}
