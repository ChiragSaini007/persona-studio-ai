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
  if (/column|relation|does not exist|avatar_agreements|admin_audit_log|PGRST/i.test(message)) {
    return NextResponse.json(
      { error: "The database is missing a recent update. Run the SQL files in supabase/migrations (in order) in the Supabase SQL editor." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export type Agreement = {
  id: string;
  persona_id: string;
  channel: string;
  signed_by_name: string;
  signer_role: string;
  signed_on: string;
  expires_on: string | null;
  scope_notes: string;
  file_path: string;
  territories?: string[];
  status: "active" | "revoked";
  uploaded_by_email: string;
  created_at: string;
};

export function agreementIsActive(agreement: Pick<Agreement, "status" | "expires_on">) {
  if (agreement.status !== "active") return false;
  return !agreement.expires_on || new Date(agreement.expires_on).getTime() >= new Date(new Date().toDateString()).getTime();
}

export async function activeAgreement(personaId: string, channel: string) {
  const rows = await supabaseRest<Agreement[]>(
    `avatar_agreements?persona_id=eq.${encodeURIComponent(personaId)}&channel=eq.${encodeURIComponent(channel)}&status=eq.active&select=*`,
  );
  return rows.find((row) => agreementIsActive(row)) || null;
}

// ---- private file storage for signed agreements ----
const bucket = "agreements";

function storageBase() {
  return `${(process.env.SUPABASE_URL || "").replace(/\/$/, "")}/storage/v1`;
}

function storageHeaders(extra: Record<string, string> = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function ensureBucket(name = bucket, limitBytes = 10 * 1024 * 1024) {
  const response = await fetch(`${storageBase()}/bucket`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: name, name, public: false, file_size_limit: limitBytes }),
  });
  // 200 = created, 400/409 = already exists
  if (!response.ok && response.status !== 400 && response.status !== 409) {
    throw new Error(`Could not prepare agreement storage (${response.status})`);
  }
}

export async function uploadAgreementFile(path: string, file: File) {
  await ensureBucket();
  const response = await fetch(`${storageBase()}/object/${bucket}/${path}`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }),
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!response.ok) throw new Error(`Agreement upload failed (${response.status})`);
}

export async function signedAgreementUrl(path: string) {
  const response = await fetch(`${storageBase()}/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: 300 }),
  });
  if (!response.ok) throw new Error(`Could not open agreement (${response.status})`);
  const data = (await response.json()) as { signedURL: string };
  return `${storageBase()}${data.signedURL}`;
}


// Country of the request. On Vercel this header is set by the platform and cannot be spoofed by the visitor.
export function requestCountry(request?: Request) {
  return (request?.headers.get("x-vercel-ip-country") || "").toUpperCase();
}

export function territoryAllows(agreement: Pick<Agreement, "territories">, country: string) {
  const territories = agreement.territories && agreement.territories.length ? agreement.territories : ["IN", "US"];
  if (!country || territories.includes("ROW")) return true; // unknown country (local development) is allowed
  return territories.includes(country);
}

// Ops-managed avatars may only talk to fans while approved, covered by an active signed text agreement,
// and only in the territories that agreement covers.
export async function managedAvatarBlocked(persona: { id?: string; managed_by_admin?: boolean; approval_status?: string }, request?: Request) {
  if (!persona.managed_by_admin) return false;
  if (persona.approval_status !== "approved") return true;
  const agreement = await activeAgreement(persona.id as string, "text");
  if (!agreement) return true;
  return !territoryAllows(agreement, requestCountry(request));
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
