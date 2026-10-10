// Voice replies. Today this uses OpenAI text-to-speech with a preset voice (not a clone of the creator's own voice).
// A cloned voice would plug in here as another provider once we have a provider key and a signed voice agreement.

export const presetVoices = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;

export const realtimeVoices = ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"] as const;

export type VoiceConfig = {
  enabled: boolean;
  provider: "openai";
  voice: string;
  instructions: string;
  realtime_enabled: boolean;
  realtime_voice: string;
};

export const defaultVoiceInstructions = "Speak warmly and naturally, like a friendly person chatting with a fan. Clear, unhurried pace.";

export function normalizeVoiceConfig(raw: unknown): VoiceConfig {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<VoiceConfig>;
  const voice = (presetVoices as readonly string[]).includes(String(value.voice)) ? String(value.voice) : "coral";
  return {
    enabled: Boolean(value.enabled),
    realtime_enabled: Boolean(value.realtime_enabled),
    realtime_voice: (realtimeVoices as readonly string[]).includes(String(value.realtime_voice)) ? String(value.realtime_voice) : "marin",
    provider: "openai",
    voice,
    instructions: typeof value.instructions === "string" && value.instructions.trim() ? value.instructions.trim().slice(0, 400) : defaultVoiceInstructions,
  };
}

export async function synthesizeSpeech(text: string, config: VoiceConfig): Promise<Buffer> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Voice needs an OpenAI key");
  const input = text.slice(0, 1500);
  const attempts: Record<string, unknown>[] = [
    { model: "gpt-4o-mini-tts", voice: config.voice, input, instructions: config.instructions, response_format: "mp3" },
    { model: "tts-1", voice: config.voice, input, response_format: "mp3" },
  ];
  let lastError = "";
  for (const body of attempts) {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    lastError = `${body.model}: ${response.status} ${(await response.text()).slice(0, 160)}`;
  }
  throw new Error(`Could not generate voice. ${lastError}`);
}
