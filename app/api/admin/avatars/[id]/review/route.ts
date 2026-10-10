import { NextRequest, NextResponse } from "next/server";
import { activeAgreement, adminError, logAudit, requireStaff } from "../../../../../../lib/admin";
import { loadAvatar, patchAvatar } from "../../../../../../lib/admin-avatars";

type Context = { params: Promise<{ id: string }> };

const signoffMethods = ["email", "whatsapp", "call", "meeting", "portal"];

// Review flow: ops submit -> admin records the creator's own sign-off and approves (or requests changes).
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
      if (!(await activeAgreement(id, "text"))) {
        return NextResponse.json({ error: "An active signed text agreement is required" }, { status: 400 });
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
      if (!(await activeAgreement(id, "text"))) {
        return NextResponse.json({ error: "The text agreement is no longer active" }, { status: 400 });
      }
      const signoff = body.signoff || {};
      const by = String(signoff.by || "").trim().slice(0, 160);
      const method = String(signoff.method || "");
      const date = String(signoff.date || "");
      if (!by || !signoffMethods.includes(method) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: "Record how the creator signed off: who, how (email, WhatsApp, call, meeting or portal) and the date" },
          { status: 400 },
        );
      }
      const saved = await patchAvatar(id, {
        approval_status: "approved",
        approved_by_email: auth.staff.email,
        approved_at: new Date().toISOString(),
      });
      await logAudit(auth.staff, "approved", id, {
        creator_signoff: { by, method, date, reference: String(signoff.reference || "").slice(0, 500) },
      });
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
