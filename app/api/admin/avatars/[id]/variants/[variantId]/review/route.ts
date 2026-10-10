import { NextRequest, NextResponse } from "next/server";
import { adminError, logAudit, requireStaff, rightsConfirmed } from "../../../../../../../../lib/admin";
import { loadAvatar } from "../../../../../../../../lib/admin-avatars";
import { loadVariant, Variant } from "../../../../../../../../lib/variants";
import { supabaseRest } from "../../../../../../../../lib/supabase-rest";

type Context = { params: Promise<{ id: string; variantId: string }> };

// Each mode is approved on its own by an admin, with an optional one-line reference.
export async function POST(request: NextRequest, context: Context) {
  const { id, variantId } = await context.params;
  const body = await request.json();
  const decision = String(body.decision || "");
  const auth = await requireStaff(request, decision === "submit" ? "ops" : "admin");
  if (auth.error) return auth.error;

  try {
    const variant = await loadVariant(variantId);
    if (!variant || variant.persona_id !== id || variant.status !== "active") return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    const set = (patch: Record<string, unknown>) =>
      supabaseRest<Variant[]>(`persona_variants?id=eq.${variantId}`, { method: "PATCH", body: { ...patch, updated_at: new Date().toISOString() }, prefer: "return=representation" });

    if (decision === "submit") {
      const avatar = await loadAvatar(id);
      if (!avatar || !rightsConfirmed(avatar)) return NextResponse.json({ error: "Confirm rights for this avatar first" }, { status: 400 });
      if (!variant.overlay.styleNotes?.trim()) return NextResponse.json({ error: "Describe how this mode should sound first" }, { status: 400 });
      const rows = await set({ approval_status: "pending" });
      await logAudit(auth.staff, "variant_submitted", id, { variant_id: variantId, name: variant.name });
      return NextResponse.json({ variant: rows[0] });
    }

    if (decision === "approve") {
      if (variant.approval_status !== "pending") return NextResponse.json({ error: "Only variants submitted for approval can be approved" }, { status: 400 });
      const rows = await set({ approval_status: "approved", approved_by_email: auth.staff.email, approved_at: new Date().toISOString() });
      await logAudit(auth.staff, "variant_approved", id, { variant_id: variantId, name: variant.name, reference: String(body.reference || "").slice(0, 500) });
      return NextResponse.json({ variant: rows[0] });
    }

    if (decision === "request_changes") {
      const note = String(body.note || "").trim().slice(0, 1000);
      if (!note) return NextResponse.json({ error: "Say what needs to change" }, { status: 400 });
      const rows = await set({ approval_status: "changes_requested", approved_by_email: null, approved_at: null });
      await logAudit(auth.staff, "variant_changes_requested", id, { variant_id: variantId, note });
      return NextResponse.json({ variant: rows[0] });
    }
    return NextResponse.json({ error: "Unknown decision" }, { status: 400 });
  } catch (error) {
    return adminError(error);
  }
}
