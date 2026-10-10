import { NextRequest, NextResponse } from "next/server";
import { savePersonaEmbeddings } from "../../../../../lib/ai";
import { adminError, Agreement, logAudit, requireStaff } from "../../../../../lib/admin";
import { loadAvatar, patchAvatar } from "../../../../../lib/admin-avatars";
import { buildRetrievalChunks, normalizeProfile } from "../../../../../lib/persona";
import { endActiveSessions } from "../../../../../lib/realtime";
import { normalizeVoiceConfig } from "../../../../../lib/tts";
import { supabaseRest } from "../../../../../lib/supabase-rest";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    const [agreements, activity] = await Promise.all([
      supabaseRest<Agreement[]>(`avatar_agreements?persona_id=eq.${id}&select=*&order=created_at.desc`),
      supabaseRest<unknown[]>(`admin_audit_log?persona_id=eq.${id}&select=*&order=created_at.desc&limit=50`),
    ]);
    return NextResponse.json({ role: auth.staff.role, avatar, agreements, activity });
  } catch (error) {
    return adminError(error);
  }
}

// Edits that change what the avatar says reset approval, and pause a live avatar until it is re-approved.
const reviewedFields = ["creator_name", "source_content", "profile", "enabled_guardrails", "custom_boundary", "fallback_text", "voice_config"] as const;

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await request.json();

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });

    const patch: Record<string, unknown> = {};
    if (typeof body.creator_name === "string") patch.creator_name = body.creator_name.trim().slice(0, 120);
    if (typeof body.source_content === "string") patch.source_content = body.source_content.slice(0, 500_000);
    if (body.profile && typeof body.profile === "object") {
      patch.profile = {
        ...normalizeProfile(body.profile, (patch.source_content as string) ?? avatar.source_content),
        retrievalChunks: buildRetrievalChunks((patch.source_content as string) ?? avatar.source_content),
      };
    } else if (typeof patch.source_content === "string") {
      patch.profile = {
        ...normalizeProfile(avatar.profile, patch.source_content as string),
        retrievalChunks: buildRetrievalChunks(patch.source_content as string),
      };
    }
    if (body.enabled_guardrails && typeof body.enabled_guardrails === "object") patch.enabled_guardrails = body.enabled_guardrails;
    if (body.voice_config && typeof body.voice_config === "object") patch.voice_config = normalizeVoiceConfig(body.voice_config);
    if (typeof body.custom_boundary === "string") patch.custom_boundary = body.custom_boundary.slice(0, 1000);
    if (typeof body.fallback_text === "string") patch.fallback_text = body.fallback_text.slice(0, 600);
    if (typeof body.internal_notes === "string") patch.internal_notes = body.internal_notes.slice(0, 4000);
    if (typeof body.claim_email === "string") patch.claim_email = body.claim_email.trim().toLowerCase().slice(0, 200) || null;

    const changedReviewed = reviewedFields.filter((field) => field in patch);
    if (changedReviewed.length && (avatar.approval_status !== "none" || avatar.status === "live")) {
      patch.approval_status = "none";
      patch.approved_by_email = null;
      patch.approved_at = null;
      if (avatar.status === "live") patch.status = "paused";
    }

    const saved = await patchAvatar(id, patch);
    if (patch.status === "paused") await endActiveSessions(id, "edited");
    if (typeof patch.source_content === "string" && saved) {
      try {
        await savePersonaEmbeddings(saved);
      } catch {
        // retrieval embeddings are best-effort
      }
    }
    await logAudit(auth.staff, "avatar_updated", id, {
      fields: Object.keys(patch).filter((key) => key !== "updated_at"),
      approval_reset: Boolean(patch.approval_status),
    });
    return NextResponse.json({ avatar: saved, approval_reset: Boolean(patch.approval_status) });
  } catch (error) {
    return adminError(error);
  }
}
