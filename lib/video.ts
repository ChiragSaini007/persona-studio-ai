import { timingSafeEqual } from "node:crypto";

// Video avatar settings. The video face itself comes from a provider (HeyGen for recorded video; real-time video needs a separate LiveAvatar account); our server supplies the brain:
// the persona, content grounding, boundaries and active genre mode. Provider calls are added once a provider account exists.

export type VideoConfig = {
  enabled: boolean;
  provider: "heygen" | "tavus";
  replica_id: string;
  consent_verified: boolean;
  notes: string;
};

export function normalizeVideoConfig(raw: unknown): VideoConfig {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<VideoConfig>;
  return {
    enabled: Boolean(value.enabled),
    provider: value.provider === "tavus" ? "tavus" : "heygen",
    replica_id: typeof value.replica_id === "string" ? value.replica_id.trim().slice(0, 120) : "",
    consent_verified: Boolean(value.consent_verified),
    notes: typeof value.notes === "string" ? value.notes.trim().slice(0, 1000) : "",
  };
}

export function videoLimits() {
  return {
    maxSeconds: Math.min(900, Math.max(30, Number(process.env.VIDEO_MAX_SECONDS) || 180)),
    dailyPerFan: Number(process.env.VIDEO_DAILY_PER_FAN) || 2,
    monthlyMinutes: Number(process.env.VIDEO_MONTHLY_MINUTES) || 120,
  };
}

// The video provider calls our brain endpoint with this shared secret as its API key.
export function brainSecretOk(request: Request) {
  const expected = process.env.VIDEO_LLM_SECRET || "";
  const header = request.headers.get("authorization") || "";
  const given = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
  if (!expected || expected.length < 24 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
