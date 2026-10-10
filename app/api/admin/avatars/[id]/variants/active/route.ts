import { NextRequest, NextResponse } from "next/server";
import { adminError, logAudit, requireStaff, rightsConfirmed } from "../../../../../../../lib/admin";
import { loadAvatar, patchAvatar } from "../../../../../../../lib/admin-avatars";
import { endActiveSessions } from "../../../../../../../lib/realtime";
import { loadVariant } from "../../../../../../../lib/variants";

type Context = { params: Promise<{ id: string }> };

// Switch which mode fans talk to. Going back to the main persona is open to any staff; activating a variant is admin only.
export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const body = await request.json();
  const variantId = typeof body.variantId === "string" ? body.variantId : null;
  const auth = await requireStaff(request, variantId ? "admin" : "ops");
  if (auth.error) return auth.error;

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });

    if (variantId) {
      const variant = await loadVariant(variantId);
      if (!variant || variant.persona_id !== id || variant.status !== "active") return NextResponse.json({ error: "Variant not found" }, { status: 404 });
      if (variant.approval_status !== "approved") return NextResponse.json({ error: "This mode needs admin approval first" }, { status: 400 });
      if (avatar.approval_status !== "approved") return NextResponse.json({ error: "The main persona must be approved first" }, { status: 400 });
      if (!rightsConfirmed(avatar)) return NextResponse.json({ error: "Rights have not been confirmed for this avatar" }, { status: 400 });
    }
    const saved = await patchAvatar(id, { active_variant_id: variantId });
    await endActiveSessions(id, "variant_changed");
    await logAudit(auth.staff, variantId ? "variant_activated" : "variant_deactivated", id, { variant_id: variantId });
    return NextResponse.json({ avatar: saved });
  } catch (error) {
    return adminError(error);
  }
}
