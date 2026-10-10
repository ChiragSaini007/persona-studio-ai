import { NextRequest, NextResponse } from "next/server";
import { adminError, Agreement, logAudit, requireStaff, signedAgreementUrl } from "../../../../../../../lib/admin";
import { patchAvatar, uuidPattern } from "../../../../../../../lib/admin-avatars";
import { supabaseRest } from "../../../../../../../lib/supabase-rest";

type Context = { params: Promise<{ id: string; agreementId: string }> };

async function findAgreement(id: string, agreementId: string) {
  if (!uuidPattern.test(id) || !uuidPattern.test(agreementId)) return null;
  const rows = await supabaseRest<Agreement[]>(`avatar_agreements?id=eq.${agreementId}&persona_id=eq.${id}&select=*`);
  return rows[0] || null;
}

// View: returns a short-lived link to the signed document. Every view is audited.
export async function GET(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id, agreementId } = await context.params;
  try {
    const agreement = await findAgreement(id, agreementId);
    if (!agreement) return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    const url = await signedAgreementUrl(agreement.file_path);
    await logAudit(auth.staff, "agreement_viewed", id, { agreement_id: agreementId, channel: agreement.channel });
    return NextResponse.json({ url });
  } catch (error) {
    return adminError(error);
  }
}

// Revoke: admin only. Revoking the text agreement pauses the avatar and clears approval.
export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireStaff(request, "admin");
  if (auth.error) return auth.error;
  const { id, agreementId } = await context.params;
  try {
    const agreement = await findAgreement(id, agreementId);
    if (!agreement) return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    await supabaseRest(`avatar_agreements?id=eq.${agreementId}`, {
      method: "PATCH",
      body: { status: "revoked", revoked_by_email: auth.staff.email, revoked_at: new Date().toISOString() },
      prefer: "return=minimal",
    });
    if (agreement.channel === "text") {
      await patchAvatar(id, { status: "paused", approval_status: "none", approved_by_email: null, approved_at: null });
    }
    await logAudit(auth.staff, "agreement_revoked", id, { agreement_id: agreementId, channel: agreement.channel });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
