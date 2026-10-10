import { NextRequest, NextResponse } from "next/server";
import { adminError, logAudit, requireStaff } from "../../../../../../../lib/admin";
import { loadAvatar, patchAvatar } from "../../../../../../../lib/admin-avatars";
import { endActiveSessions } from "../../../../../../../lib/realtime";
import { loadVariant, normalizeOverlay, Variant } from "../../../../../../../lib/variants";
import { supabaseRest } from "../../../../../../../lib/supabase-rest";

type Context = { params: Promise<{ id: string; variantId: string }> };

async function ownedVariant(id: string, variantId: string) {
  const variant = await loadVariant(variantId);
  return variant && variant.persona_id === id ? variant : null;
}

// Editing a variant resets its approval, and switches it off for fans if it was the active mode.
export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id, variantId } = await context.params;
  const body = await request.json();
  try {
    const variant = await ownedVariant(id, variantId);
    const avatar = await loadAvatar(id);
    if (!variant || !avatar) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), approval_status: "none", approved_by_email: null, approved_at: null };
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
    if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 500);
    if (body.overlay) patch.overlay = normalizeOverlay(body.overlay);

    const rows = await supabaseRest<Variant[]>(`persona_variants?id=eq.${variantId}`, { method: "PATCH", body: patch, prefer: "return=representation" });
    let deactivated = false;
    if (avatar.active_variant_id === variantId) {
      await patchAvatar(id, { active_variant_id: null });
      await endActiveSessions(id, "variant_changed");
      deactivated = true;
    }
    await logAudit(auth.staff, "variant_updated", id, { variant_id: variantId, fields: Object.keys(patch), deactivated });
    return NextResponse.json({ variant: rows[0], approval_reset: true, deactivated });
  } catch (error) {
    return adminError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireStaff(request, "admin");
  if (auth.error) return auth.error;
  const { id, variantId } = await context.params;
  try {
    const variant = await ownedVariant(id, variantId);
    const avatar = await loadAvatar(id);
    if (!variant || !avatar) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    await supabaseRest(`persona_variants?id=eq.${variantId}`, { method: "PATCH", body: { status: "archived", updated_at: new Date().toISOString() }, prefer: "return=minimal" });
    if (avatar.active_variant_id === variantId) {
      await patchAvatar(id, { active_variant_id: null });
      await endActiveSessions(id, "variant_changed");
    }
    await logAudit(auth.staff, "variant_archived", id, { variant_id: variantId, name: variant.name });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
