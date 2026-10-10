import { NextRequest, NextResponse } from "next/server";
import { generateProfileWithAI } from "../../../../../../lib/ai";
import { activeAgreement, adminError, logAudit, requireStaff } from "../../../../../../lib/admin";
import { loadAvatar, patchAvatar } from "../../../../../../lib/admin-avatars";
import { buildRetrievalChunks } from "../../../../../../lib/persona";

type Context = { params: Promise<{ id: string }> };

// Drafts the avatar's profile from its content. Needs a signed, active text agreement.
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    if (!(await activeAgreement(id, "text"))) {
      return NextResponse.json({ error: "Upload an active signed text agreement before training this avatar" }, { status: 400 });
    }
    if (avatar.source_content.trim().length < 100) {
      return NextResponse.json({ error: "Add at least a few paragraphs of content first" }, { status: 400 });
    }

    const brief = [`Creator name: ${avatar.creator_name}`, "Approved creator content:", avatar.source_content.slice(0, 60_000)].join("\n\n");
    const result = await generateProfileWithAI(brief);
    const profile = {
      ...result.profile,
      bio: avatar.profile.bio || result.profile.bio,
      retrievalChunks: buildRetrievalChunks(avatar.source_content),
    };
    const saved = await patchAvatar(id, {
      profile,
      approval_status: "none",
      approved_by_email: null,
      approved_at: null,
      ...(avatar.status === "live" ? { status: "paused" } : {}),
    });
    await logAudit(auth.staff, "profile_drafted", id, { used_ai: result.usedAI });
    return NextResponse.json({ avatar: saved, used_ai: result.usedAI });
  } catch (error) {
    return adminError(error);
  }
}
