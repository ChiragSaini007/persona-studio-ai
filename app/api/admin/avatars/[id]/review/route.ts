import { NextRequest, NextResponse } from "next/server";
import { adminError, logAudit, requireStaff, rightsConfirmed } from "../../../../../../lib/admin";
import { loadAvatar, patchAvatar } from "../../../../../../lib/admin-avatars";

type Context = { params: Promise<{ id: string }> };

// Review flow: ops submit, an admin approves (or asks for changes). Approval can carry a one-line reference,
// for example "approved on WhatsApp, 12 Oct".
export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const body = await request.json();
  const decision = String(body.decision || "");

  const auth = await requireStaff(request, decision === "submit" ? "ops" : "admin");
  if (auth.error) return auth.error;

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });

    if (decision === "submit") {
      if (!rightsConfirmed(avatar)) {
        return NextResponse.json({ error: "Confirm rights for this avatar first" }, { status: 400 });
      }
      if (avatar.source_content.trim().length < 200) {
        return NextResponse.json({ error: "Add more content before submitting for approval" }, { status: 400 });
      }
      const saved = await patchAvatar(id, { approval_status: "pending" });
      await logAudit(auth.staff, "submitted_for_approval", id, { note: String(body.note || "").slice(0, 1000) });
      return NextResponse.json({ avatar: saved });
    }

    if (decision === "approve") {
      if (avatar.approval_status !== "pending") {
        return NextResponse.json({ error: "Only avatars submitted for approval can be approved" }, { status: 400 });
      }
      if (!rightsConfirmed(avatar)) {
        return NextResponse.json({ error: "Rights have not been confirmed for this avatar" }, { status: 400 });
      }
      const saved = await patchAvatar(id, {
        approval_status: "approved",
        approved_by_email: auth.staff.email,
        approved_at: new Date().toISOString(),
      });
      await logAudit(auth.staff, "approved", id, { reference: String(body.reference || "").slice(0, 500) });
      return NextResponse.json({ avatar: saved });
    }

    if (decision === "request_changes") {
      const note = String(body.note || "").trim().slice(0, 1000);
      if (!note) return NextResponse.json({ error: "Say what needs to change" }, { status: 400 });
      const saved = await patchAvatar(id, { approval_status: "changes_requested", approved_by_email: null, approved_at: null });
      await logAudit(auth.staff, "changes_requested", id, { note });
      return NextResponse.json({ avatar: saved });
    }

    return NextResponse.json({ error: "Unknown decision" }, { status: 400 });
  } catch (error) {
    return adminError(error);
  }
}
