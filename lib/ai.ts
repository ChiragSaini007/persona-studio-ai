import { buildLocalReply, makeFallbackProfile, normalizeProfile, PersonaRecord, PersonaProfile } from "./persona";

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
            "Extract an AI persona profile from creator-provided content. Return only JSON with keys topics, phrases, tone, bio, fanRelationship, responseStyle. topics, phrases, and tone must be arrays of 3-8 short strings. bio, fanRelationship, and responseStyle must be concise strings that help the AI sound like the creator while still respecting safety boundaries.",
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
            required: ["topics", "phrases", "tone", "bio", "fanRelationship", "responseStyle"],
            properties: {
              topics: { type: "array", items: { type: "string" } },
              phrases: { type: "array", items: { type: "string" } },
              tone: { type: "array", items: { type: "string" } },
              bio: { type: "string" },
              fanRelationship: { type: "string" },
              responseStyle: { type: "string" },
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
    return { profile: normalizeProfile(JSON.parse(text), content), usedAI: true };
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
  const profile = normalizeProfile(persona.profile, persona.source_content);
  if (flagReason || !process.env.OPENAI_API_KEY) {
    return { reply: buildLocalReply({ ...persona, profile }, text, flagReason), usedAI: false };
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
            `You are ${persona.creator_name}'s AI persona for fan conversations.`,
            "The page already discloses that this is AI. In the conversation, write naturally in the creator's first-person voice when appropriate.",
            "Sound like the creator's public persona: warm, direct, familiar, and conversational.",
            "Do not say you are an AI in every answer. Only mention that you are an AI persona if the fan asks who/what you are or asks for real-world access.",
            "Never claim to be the actual human, never claim real-time personal access, and never invent private facts.",
            "Only answer using the approved persona profile and creator-provided source content.",
            "If the question is outside approved topics, use the fallback exactly.",
            `Fallback: ${persona.fallback_text}`,
            `Creator bio: ${profile.bio}`,
            `Fan relationship: ${profile.fanRelationship}`,
            `Response style: ${profile.responseStyle}`,
            `Approved topics: ${profile.topics.join(", ")}`,
            `Tone: ${profile.tone.join(", ")}`,
            `Recurring phrases: ${profile.phrases.join(", ")}`,
            `Creator source content: ${persona.source_content.slice(0, 8000)}`,
          ].join("\n"),
        },
        { role: "user", content: text },
      ],
      max_output_tokens: 220,
    }),
  });

  if (!response.ok) return { reply: buildLocalReply({ ...persona, profile }, text, flagReason), usedAI: false };
  const data = await response.json();
  return { reply: data.output_text || buildLocalReply({ ...persona, profile }, text, flagReason), usedAI: true };
}
