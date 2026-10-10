import { NextRequest, NextResponse } from "next/server";
import { adminError, logAudit, requireStaff } from "../../../../../../lib/admin";
import { loadAvatar } from "../../../../../../lib/admin-avatars";
import { genreTemplates, normalizeOverlay, Variant } from "../../../../../../lib/variants";
import { supabaseRest } from "../../../../../../lib/supabase-rest";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    const variants = await supabaseRest<Variant[]>(`persona_variants?persona_id=eq.${id}&status=eq.active&select=*&order=created_at.asc`);
    return NextResponse.json({ variants, active_variant_id: avatar.active_variant_id || null, templates: genreTemplates });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await request.json();
  const template = genreTemplates.find((item) => item.genre === body.genre) || genreTemplates[genreTemplates.length - 1];
  const name = (typeof body.name === "string" && body.name.trim().slice(0, 80)) || template.label;

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    const rows = await supabaseRest<Variant[]>("persona_variants", {
      method: "POST",
      prefer: "return=representation",
      body: {
        persona_id: id,
        name,
        genre: template.genre,
        description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : "",
        overlay: normalizeOverlay(body.overlay ?? template.overlay),
        created_by_email: auth.staff.email,
      },
    });
    await logAudit(auth.staff, "variant_created", id, { variant_id: rows[0].id, name, genre: template.genre });
    return NextResponse.json({ variant: rows[0] });
  } catch (error) {
    return adminError(error);
  }
}
