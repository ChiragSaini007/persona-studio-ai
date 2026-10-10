import { NextRequest, NextResponse } from "next/server";
import { adminError, logAudit, requireStaff } from "../../../../../../lib/admin";
import { loadAvatar, patchAvatar } from "../../../../../../lib/admin-avatars";
import { endActiveSessions } from "../../../../../../lib/realtime";

type Context = { params: Promise<{ id: string }> };

const allowedTerritories = ["IN", "US", "ROW"];

// Agreements are signed outside the tool. Here staff record that rights were confirmed, with a one-line reference,
// and where the avatar may be used.
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await request.json();

  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 300) : "";
  const territories = (Array.isArray(body.territories) ? body.territories : [])
    .map((item: unknown) => String(item).toUpperCase())
    .filter((item: string) => allowedTerritories.includes(item));

  if (body.confirm !== true) return NextResponse.json({ error: "Tick the box to confirm rights" }, { status: 400 });
  if (reference.length < 5) return NextResponse.json({ error: "Add a one-line reference, for example where the signed agreement is kept" }, { status: 400 });
  if (!territories.length) return NextResponse.json({ error: "Choose where this avatar may be used" }, { status: 400 });

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    const saved = await patchAvatar(id, {
      rights_confirmed_by_email: auth.staff.email,
      rights_confirmed_at: new Date().toISOString(),
      rights_reference: reference,
      territories,
    });
    await logAudit(auth.staff, avatar.rights_confirmed_at ? "rights_updated" : "rights_confirmed", id, { reference, territories });
    return NextResponse.json({ avatar: saved });
  } catch (error) {
    return adminError(error);
  }
}

// Withdraw: admin only. Pauses the avatar, clears approval, and ends any live calls.
export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireStaff(request, "admin");
  if (auth.error) return auth.error;
  const { id } = await context.params;
  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    const saved = await patchAvatar(id, {
      rights_confirmed_by_email: null,
      rights_confirmed_at: null,
      rights_reference: null,
      status: avatar.status === "live" ? "paused" : avatar.status,
      approval_status: "none",
      approved_by_email: null,
      approved_at: null,
      active_variant_id: null,
    });
    await endActiveSessions(id, "rights_withdrawn");
    await logAudit(auth.staff, "rights_withdrawn", id, {});
    return NextResponse.json({ avatar: saved });
  } catch (error) {
    return adminError(error);
  }
}
