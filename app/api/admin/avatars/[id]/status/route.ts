import { NextRequest, NextResponse } from "next/server";
import { activeAgreement, adminError, logAudit, requireStaff } from "../../../../../../lib/admin";
import { loadAvatar, patchAvatar } from "../../../../../../lib/admin-avatars";
import { endActiveSessions } from "../../../../../../lib/realtime";

type Context = { params: Promise<{ id: string }> };

// Publish (admin only, needs approval + active agreement) or pause (any staff, instantly).
export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const body = await request.json();
  const status = String(body.status || "");
  if (!["live", "paused"].includes(status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });

  const auth = await requireStaff(request, status === "live" ? "admin" : "ops");
  if (auth.error) return auth.error;

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });

    if (status === "live") {
      if (avatar.approval_status !== "approved") {
        return NextResponse.json({ error: "This avatar needs recorded creator sign-off and approval before it can go live" }, { status: 400 });
      }
      if (!(await activeAgreement(id, "text"))) {
        return NextResponse.json({ error: "No active signed text agreement" }, { status: 400 });
      }
    }
    const saved = await patchAvatar(id, { status });
    if (status === "paused") await endActiveSessions(id, "paused");
    await logAudit(auth.staff, status === "live" ? "published" : "paused", id, {});
    return NextResponse.json({ avatar: saved });
  } catch (error) {
    return adminError(error);
  }
}
