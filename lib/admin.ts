import { NextRequest, NextResponse } from "next/server";
import { bearerToken, getAuthUser } from "./auth";
import { supabaseRest } from "./supabase-rest";

export type StaffRole = "admin" | "ops";
export type Staff = { userId: string; email: string; role: StaffRole };

function emailList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

// ADMIN_EMAILS can train, approve, and publish. OPS_EMAILS can train and submit for approval.
export function roleForEmail(email: string): StaffRole | null {
  const lower = email.toLowerCase();
  if (emailList(process.env.ADMIN_EMAILS).includes(lower)) return "admin";
  if (emailList(process.env.OPS_EMAILS).includes(lower)) return "ops";
  return null;
}

export async function getStaff(request: NextRequest): Promise<Staff | null> {
  const user = await getAuthUser(bearerToken(request));
  if (!user?.email || !user.emailConfirmed) return null;
  const role = roleForEmail(user.email);
  return role ? { userId: user.id, email: user.email.toLowerCase(), role } : null;
}

type StaffResult = { staff: Staff; error?: undefined } | { staff?: undefined; error: NextResponse };

export async function requireStaff(request: NextRequest, minimum: StaffRole = "ops"): Promise<StaffResult> {
  const staff = await getStaff(request);
  if (!staff) return { error: NextResponse.json({ error: "Staff access required" }, { status: 403 }) };
  if (minimum === "admin" && staff.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin approval rights required" }, { status: 403 }) };
  }
  return { staff };
}

export async function logAudit(staff: Staff, action: string, personaId: string | null, details: Record<string, unknown> = {}) {
  await supabaseRest("admin_audit_log", {
    method: "POST",
    body: { actor_user_id: staff.userId, actor_email: staff.email, action, persona_id: personaId, details },
    prefer: "return=minimal",
  });
}

export function adminError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  if (/column|relation|does not exist|admin_audit_log|PGRST/i.test(message)) {
    return NextResponse.json(
      { error: "The database is missing a recent update. Run the SQL files in supabase/migrations (in order) in the Supabase SQL editor." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

// ---- private file storage ----
function storageBase() {
  return `${(process.env.SUPABASE_URL || "").replace(/\/$/, "")}/storage/v1`;
}

function storageHeaders(extra: Record<string, string> = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function ensureBucket(name: string, limitBytes: number) {
  const response = await fetch(`${storageBase()}/bucket`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: name, name, public: false, file_size_limit: limitBytes }),
  });
  // 200 = created, 400/409 = already exists
  if (!response.ok && response.status !== 400 && response.status !== 409) {
    throw new Error(`Could not prepare storage (${response.status})`);
  }
}

// Country of the request. On Vercel this header is set by the platform and cannot be spoofed by the visitor.
export function requestCountry(request?: Request) {
  return (request?.headers.get("x-vercel-ip-country") || "").toUpperCase();
}

export function territoryAllows(territories: string[] | null | undefined, country: string) {
  const allowed = territories && territories.length ? territories : ["IN", "US"];
  if (!country || allowed.includes("ROW")) return true; // unknown country (local development) is allowed
  return allowed.includes(country);
}

type RightsFields = { rights_confirmed_at?: string | null; territories?: string[] | null };

export function rightsConfirmed(avatar: RightsFields) {
  return Boolean(avatar.rights_confirmed_at);
}

// Ops-managed avatars only talk to fans while approved, with rights confirmed, and in the territories set for them.
export function managedAvatarBlocked(
  persona: { managed_by_admin?: boolean; approval_status?: string } & RightsFields,
  request?: Request,
) {
  if (!persona.managed_by_admin) return false;
  if (persona.approval_status !== "approved" || !rightsConfirmed(persona)) return true;
  return !territoryAllows(persona.territories, requestCountry(request));
}

// ---- training files (PDF, audio, text): uploaded straight from the browser to storage ----
const trainingBucket = "training";
export const maxTrainingFileBytes = 25 * 1024 * 1024;

export async function createTrainingUpload(path: string) {
  await ensureBucket(trainingBucket, maxTrainingFileBytes);
  const response = await fetch(`${storageBase()}/object/upload/sign/${trainingBucket}/${path}`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: "{}",
  });
  if (!response.ok) throw new Error(`Could not prepare the upload (${response.status})`);
  const data = (await response.json()) as { url: string };
  return `${storageBase()}${data.url}`;
}

export async function downloadTrainingFile(path: string) {
  const response = await fetch(`${storageBase()}/object/${trainingBucket}/${path}`, { headers: storageHeaders() });
  if (!response.ok) throw new Error(`Could not read the uploaded file (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}
