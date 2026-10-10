import { NextRequest, NextResponse } from "next/server";
import { adminError, agreementIsActive, Agreement, logAudit, requireStaff } from "../../../../lib/admin";
import { AdminPersona } from "../../../../lib/admin-avatars";
import { cleanHandle, guardrails, normalizeProfile } from "../../../../lib/persona";
import { genreTemplates } from "../../../../lib/variants";
import { supabaseRest } from "../../../../lib/supabase-rest";

const listColumns =
  "id,creator_name,creator_handle,status,managed_by_admin,approval_status,claim_email,approved_by_email,approved_at,created_at,updated_at";

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  try {
    const [avatars, agreements] = await Promise.all([
      supabaseRest<AdminPersona[]>(`personas?select=${listColumns}&order=updated_at.desc&limit=500`),
      supabaseRest<Agreement[]>(`avatar_agreements?select=persona_id,channel,status,expires_on`),
    ]);
    const channelsByAvatar = new Map<string, string[]>();
    for (const agreement of agreements) {
      if (!agreementIsActive(agreement)) continue;
      const list = channelsByAvatar.get(agreement.persona_id) || [];
      if (!list.includes(agreement.channel)) list.push(agreement.channel);
      channelsByAvatar.set(agreement.persona_id, list);
    }
    return NextResponse.json({
      role: auth.staff.role,
      avatars: avatars.map((avatar) => ({ ...avatar, agreement_channels: channelsByAvatar.get(avatar.id as string) || [] })),
    });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json();

  // Reference example for the creative team. It is a practice record, never publishable, with no invented facts about the person.
  if (body.example === true) {
    try {
      const existing = await supabaseRest<AdminPersona[]>("personas?creator_handle=eq.srk-example&select=*");
      if (existing[0]) return NextResponse.json({ avatar: existing[0], existed: true });
      const rows = await supabaseRest<AdminPersona[]>("personas", {
        method: "POST",
        prefer: "return=representation",
        body: {
          creator_user_id: null,
          creator_name: "Shah Rukh Khan (example)",
          creator_handle: "srk-example",
          source_content:
            "EXAMPLE AVATAR. This record shows the creative team how an avatar is set up from start to finish. It is not affiliated with or endorsed by the person named, it has no agreement on file, and it can never be published. For a real avatar, replace this text with the creator's approved material: interviews, press kits, captions and FAQs, each with the creator's consent. Nothing here is a statement by, or about, the person named.",
          profile: { ...normalizeProfile({}, ""), bio: "Example record. Replace with the creator's approved bio.", supportedLanguages: ["English", "Hindi", "Hinglish"] },
          enabled_guardrails: Object.fromEntries(guardrails.map((rail) => [rail.key, true])),
          custom_boundary: "",
          fallback_text: "I cannot speak to that one. It is outside the boundaries this AI avatar is approved to discuss, so please check the creator's official channels.",
          monetization: "free",
          price_cents: 0,
          status: "draft",
          managed_by_admin: true,
          is_example: true,
          approval_status: "none",
          internal_notes: "Reference example only. Not affiliated with or endorsed by the person named. Cannot be published.",
          created_by_admin_email: auth.staff.email,
        },
      });
      const avatar = rows[0];
      await supabaseRest("persona_variants", {
        method: "POST",
        prefer: "return=minimal",
        body: ["action", "romance", "comedy", "horror"].map((genre) => {
          const template = genreTemplates.find((item) => item.genre === genre)!;
          return { persona_id: avatar.id, name: `${template.label} mode`, genre, overlay: template.overlay, created_by_email: auth.staff.email };
        }),
      });
      await logAudit(auth.staff, "example_avatar_created", avatar.id as string, { handle: "srk-example" });
      return NextResponse.json({ avatar });
    } catch (error) {
      return adminError(error);
    }
  }

  const name = typeof body.creator_name === "string" ? body.creator_name.trim().slice(0, 120) : "";
  const rawHandle = typeof body.creator_handle === "string" ? body.creator_handle.trim() : "";
  if (!name || !rawHandle.replace(/^@/, "")) {
    return NextResponse.json({ error: "Name and handle are required" }, { status: 400 });
  }
  const handle = cleanHandle(rawHandle);

  try {
    const existing = await supabaseRest<{ id: string }[]>(`personas?creator_handle=eq.${encodeURIComponent(handle)}&select=id`);
    if (existing[0]) return NextResponse.json({ error: "That handle is already taken" }, { status: 409 });

    const rows = await supabaseRest<AdminPersona[]>("personas", {
      method: "POST",
      prefer: "return=representation",
      body: {
        creator_user_id: null,
        creator_name: name,
        creator_handle: handle,
        source_content: "",
        profile: normalizeProfile({}, ""),
        enabled_guardrails: Object.fromEntries(guardrails.map((rail) => [rail.key, true])),
        custom_boundary: "",
        fallback_text:
          "I cannot speak to that one. It is outside the boundaries this AI avatar is approved to discuss, so please check the creator's official channels.",
        monetization: "free",
        price_cents: 0,
        status: "draft",
        managed_by_admin: true,
        approval_status: "none",
        claim_email: typeof body.claim_email === "string" ? body.claim_email.trim().toLowerCase().slice(0, 200) || null : null,
        internal_notes: typeof body.internal_notes === "string" ? body.internal_notes.slice(0, 4000) : "",
        created_by_admin_email: auth.staff.email,
      },
    });
    const avatar = rows[0];
    await logAudit(auth.staff, "avatar_created", avatar.id as string, { name, handle });
    return NextResponse.json({ avatar });
  } catch (error) {
    return adminError(error);
  }
}
