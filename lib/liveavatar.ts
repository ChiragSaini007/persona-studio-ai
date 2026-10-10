// LiveAvatar (HeyGen's real-time avatar product). A separate account, key and credit balance from the HeyGen video API.
// Sessions run in FULL mode: LiveAvatar handles the conversation pipeline, and we supply the avatar's brain as a custom LLM.

const base = "https://api.liveavatar.com";

// Public sandbox avatar. Sandbox sessions use no credits, last about a minute, and only allow this avatar.
export const sandboxAvatarId = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";

export function liveavatarConfigured() {
  return Boolean(process.env.LIVEAVATAR_API_KEY);
}

type LiveAvatarResponse<T> = { code?: number; message?: string; data?: T };

async function call<T>(path: string, options: { method?: string; body?: unknown; bearer?: string } = {}): Promise<T> {
  const key = process.env.LIVEAVATAR_API_KEY;
  if (!key && !options.bearer) throw new Error("LiveAvatar is not connected");
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.bearer ? { Authorization: `Bearer ${options.bearer}` } : { "X-API-KEY": key as string }),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const text = await response.text();
  let parsed: LiveAvatarResponse<T> & { detail?: unknown } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // non-JSON error body
  }
  if (!response.ok) {
    const detail = parsed.message || (parsed.detail ? JSON.stringify(parsed.detail).slice(0, 300) : text.slice(0, 200));
    throw new Error(`LiveAvatar ${path} failed (${response.status}): ${detail}`);
  }
  return (parsed.data ?? (parsed as unknown)) as T;
}

export async function laCredits() {
  const data = await call<{ credits_left?: string }>("/v1/users/credits");
  return Number(data.credits_left ?? 0);
}

export type LaVoice = { id: string; name: string; language: string; gender: string };

export async function laListVoices(pageSize = 100) {
  const data = await call<{ results?: LaVoice[] }>(`/v1/voices?page_size=${pageSize}`);
  return data.results || [];
}

export async function laCreateSessionToken(input: {
  avatarId: string;
  sandbox: boolean;
  voiceId?: string;
  contextId?: string;
  language?: string;
  maxSeconds?: number;
  llmConfigurationId?: string;
}) {
  const persona: Record<string, unknown> = { language: input.language || "en" };
  if (input.voiceId) persona.voice_id = input.voiceId;
  if (input.contextId) persona.context_id = input.contextId;
  return call<{ session_id: string; session_token: string }>("/v1/sessions/token", {
    method: "POST",
    body: {
      mode: "FULL",
      avatar_id: input.avatarId,
      is_sandbox: input.sandbox,
      max_session_duration: input.maxSeconds,
      interactivity_type: "CONVERSATIONAL",
      avatar_persona: persona,
      ...(input.llmConfigurationId ? { llm_configuration_id: input.llmConfigurationId } : {}),
    },
  });
}

export async function laStartSession(sessionToken: string) {
  return call<{ session_id: string; livekit_url: string; livekit_client_token: string; max_session_duration?: number }>("/v1/sessions/start", {
    method: "POST",
    bearer: sessionToken,
  });
}

export async function laStopSession(sessionId: string, reason = "USER_CLOSED") {
  await call("/v1/sessions/stop", { method: "POST", body: { session_id: sessionId, reason } });
}
