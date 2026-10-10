import { PersonaRecord } from "./persona";
import { supabaseRest } from "./supabase-rest";

export type AdminPersona = PersonaRecord & {
  managed_by_admin?: boolean;
  claim_email?: string | null;
  approval_status?: "none" | "pending" | "approved" | "changes_requested";
  approved_by_email?: string | null;
  approved_at?: string | null;
  created_by_admin_email?: string | null;
  internal_notes?: string;
  created_at?: string;
  updated_at?: string;
};

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadAvatar(id: string): Promise<AdminPersona | null> {
  if (!uuidPattern.test(id)) return null;
  const rows = await supabaseRest<AdminPersona[]>(`personas?id=eq.${id}&select=*`);
  return rows[0] || null;
}

export async function patchAvatar(id: string, patch: Record<string, unknown>) {
  const rows = await supabaseRest<AdminPersona[]>(`personas?id=eq.${id}`, {
    method: "PATCH",
    body: { ...patch, updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  return rows[0];
}
