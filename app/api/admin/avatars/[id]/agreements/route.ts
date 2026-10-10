import { NextRequest, NextResponse } from "next/server";
import { adminError, Agreement, logAudit, requireStaff, uploadAgreementFile } from "../../../../../../lib/admin";
import { loadAvatar } from "../../../../../../lib/admin-avatars";
import { supabaseRest } from "../../../../../../lib/supabase-rest";

type Context = { params: Promise<{ id: string }> };

const channels = ["text", "voice", "realtime_voice", "video", "realtime_video"];
const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    const channel = String(form.get("channel") || "");
    const signedBy = String(form.get("signed_by_name") || "").trim().slice(0, 160);
    const signerRole = String(form.get("signer_role") || "");
    const signedOn = String(form.get("signed_on") || "");
    const expiresOn = String(form.get("expires_on") || "") || null;

    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Attach the signed agreement" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Agreement file must be 10 MB or smaller" }, { status: 400 });
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: "Use a PDF, PNG, JPG or WebP file" }, { status: 400 });
    if (!channels.includes(channel)) return NextResponse.json({ error: "Choose a channel" }, { status: 400 });
    if (!signedBy) return NextResponse.json({ error: "Who signed the agreement?" }, { status: 400 });
    if (!["creator", "authorised_representative"].includes(signerRole)) return NextResponse.json({ error: "Choose the signer's role" }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(signedOn)) return NextResponse.json({ error: "Enter the date it was signed" }, { status: 400 });
    if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return NextResponse.json({ error: "Enter a valid expiry date" }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${id}/${Date.now()}-${safeName}`;
    await uploadAgreementFile(path, file);

    const rows = await supabaseRest<Agreement[]>("avatar_agreements", {
      method: "POST",
      prefer: "return=representation",
      body: {
        persona_id: id,
        channel,
        signed_by_name: signedBy,
        signer_role: signerRole,
        signed_on: signedOn,
        expires_on: expiresOn,
        scope_notes: String(form.get("scope_notes") || "").slice(0, 2000),
        file_path: path,
        uploaded_by_email: auth.staff.email,
      },
    });
    await logAudit(auth.staff, "agreement_uploaded", id, { channel, signed_by: signedBy, signer_role: signerRole, signed_on: signedOn, expires_on: expiresOn });
    return NextResponse.json({ agreement: rows[0] });
  } catch (error) {
    return adminError(error);
  }
}
