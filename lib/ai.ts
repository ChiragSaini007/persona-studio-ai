import { buildLocalReply, makeFallbackProfile, PersonaRecord, PersonaProfile } from "./persona";

const openaiUrl = "https://api.openai.com/v1/responses";
const moderationUrl = "https://api.openai.com/v1/moderations";

export function hasOpenAIConfig() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateProfileWithAI(content: string): Promise<{ profile: PersonaProfile; usedAI: boolean }> {
  if (!process.env.OPENAI_API_KEY) {
    return { profile: makeFallbackProfile(content), usedAI: false };
  }

  const response = await fetch(openaiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Extract a conservative AI persona profile from creator-provided content. Return only JSON with keys topics, phrases, tone. Each value must be an array of 3-8 short strings.",
        },
        { role: "user", content },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "persona_profile",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["topics", "phrases", "tone"],
            properties: {
              topics: { type: "array", items: { type: "string" } },
              phrases: { type: "array", items: { type: "string" } },
              tone: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) return { profile: makeFallbackProfile(content), usedAI: false };
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content || []).find((item: { text?: string }) => item.text)?.text;

  try {
    return { profile: JSON.parse(text), usedAI: true };
  } catch {
    return { profile: makeFallbackProfile(content), usedAI: false };
  }
}

export async function moderateText(text: string) {
  if (!process.env.OPENAI_API_KEY) return "";

  const response = await fetch(moderationUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest",
      input: text,
    }),
  });

  if (!response.ok) return "";
  const data = await response.json();
  const result = data.results?.[0];
  if (!result?.flagged) return "";

  const category = Object.entries(result.categories || {}).find(([, flagged]) => flagged)?.[0];
  return category ? `Moderation: ${category}` : "Moderation";
}

export async function generateChatReply(persona: PersonaRecord, text: string, flagReason: string) {
  if (flagReason || !process.env.OPENAI_API_KEY) {
    return { reply: buildLocalReply(persona, text, flagReason), usedAI: false };
  }

  const response = await fetch(openaiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            `You are a disclosed AI persona for ${persona.creator_name}.`,
            "Never claim to be the real person.",
            "Only answer using the approved persona profile and creator-provided source content.",
            "If the question is outside approved topics, use the fallback exactly.",
            `Fallback: ${persona.fallback_text}`,
            `Approved topics: ${persona.profile.topics.join(", ")}`,
            `Tone: ${persona.profile.tone.join(", ")}`,
            `Recurring phrases: ${persona.profile.phrases.join(", ")}`,
            `Creator source content: ${persona.source_content.slice(0, 8000)}`,
          ].join("\n"),
        },
        { role: "user", content: text },
      ],
      max_output_tokens: 220,
    }),
  });

  if (!response.ok) return { reply: buildLocalReply(persona, text, flagReason), usedAI: false };
  const data = await response.json();
  return { reply: data.output_text || buildLocalReply(persona, text, flagReason), usedAI: true };
}
