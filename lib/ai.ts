import {
  buildLocalReply,
  buildRetrievalChunks,
  detectChatIntent,
  makeFallbackProfile,
  normalizeProfile,
  PersonaRecord,
  PersonaProfile,
} from "./persona";
import { supabaseRest } from "./supabase-rest";

const openaiUrl = "https://api.openai.com/v1/responses";
const moderationUrl = "https://api.openai.com/v1/moderations";
const embeddingsUrl = "https://api.openai.com/v1/embeddings";

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
            "Extract an AI persona profile from creator-provided content. Return only JSON with keys topics, phrases, tone, bio, fanRelationship, responseStyle, greetingStyle, exampleReplies, neverSay, retrievalChunks. topics, phrases, tone, exampleReplies, neverSay, and retrievalChunks must be arrays of 3-8 short strings. bio, fanRelationship, responseStyle, and greetingStyle must be concise strings that help the AI sound like the creator while still respecting safety boundaries. exampleReplies should capture ideal fan-facing answers in the creator's style, including short/casual answers. neverSay should capture claims the persona must avoid. retrievalChunks should be the most useful source passages for answering fan questions.",
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
            required: [
              "topics",
              "phrases",
              "tone",
              "bio",
              "fanRelationship",
              "responseStyle",
              "greetingStyle",
              "exampleReplies",
              "neverSay",
              "retrievalChunks",
            ],
            properties: {
              topics: { type: "array", items: { type: "string" } },
              phrases: { type: "array", items: { type: "string" } },
              tone: { type: "array", items: { type: "string" } },
              bio: { type: "string" },
              fanRelationship: { type: "string" },
              responseStyle: { type: "string" },
              greetingStyle: { type: "string" },
              exampleReplies: { type: "array", items: { type: "string" } },
              neverSay: { type: "array", items: { type: "string" } },
              retrievalChunks: { type: "array", items: { type: "string" } },
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

type ChatTurn = {
  role: "fan" | "persona";
  text: string;
};

export async function generateChatReply(persona: PersonaRecord, text: string, flagReason: string, history: ChatTurn[] = []) {
  const profile = normalizeProfile(persona.profile, persona.source_content);
  const relevantContext = await retrieveRelevantContext(profile, persona.source_content, text, persona.id);
  const intent = detectChatIntent(text, flagReason);
  if (flagReason) {
    return { reply: buildLocalReply({ ...persona, profile }, text, flagReason), usedAI: false };
  }
  if (intent === "greeting" || intent === "vague") {
    return { reply: buildLocalReply({ ...persona, profile }, text, flagReason), usedAI: false };
  }
  if (!process.env.OPENAI_API_KEY) {
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
            `Detected fan intent: ${intent}.`,
            "If the fan is greeting you, reply with a short warm greeting and invite a real question. Do not give advice.",
            "If the fan is vague, ask one short follow-up question. Do not guess what they meant.",
            "If the fan asks a real question, answer directly using the creator profile, examples, chat context, and retrieved creator context.",
            "Do not say you are an AI in every answer. Only mention that you are an AI persona if the fan asks who/what you are or asks for real-world access.",
            "Never claim to be the actual human, never claim real-time personal access, and never invent private facts.",
            "Do not force catchphrases. Use recurring phrases only when they naturally fit the fan's message.",
            "Match the length of the fan message: short casual messages get short casual replies; detailed questions can get more detailed answers.",
            "Only answer using the approved persona profile, example replies, chat context, and retrieved creator-provided source content.",
            "If the question is outside approved topics, use the fallback exactly.",
            "If the creator content is insufficient, say what you can answer from the approved material and ask one useful follow-up.",
            `Fallback: ${persona.fallback_text}`,
            `Creator bio: ${profile.bio}`,
            `Fan relationship: ${profile.fanRelationship}`,
            `Response style: ${profile.responseStyle}`,
            `Greeting style: ${profile.greetingStyle}`,
            `Ideal example replies:\n${profile.exampleReplies.map((item) => `- ${item}`).join("\n")}`,
            `Never say or imply:\n${profile.neverSay.map((item) => `- ${item}`).join("\n")}`,
            `Approved topics: ${profile.topics.join(", ")}`,
            `Tone: ${profile.tone.join(", ")}`,
            `Recurring phrases: ${profile.phrases.join(", ")}`,
            `Recent chat context:\n${formatChatContext(history)}`,
            `Retrieved creator context:\n${relevantContext}`,
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

function formatChatContext(history: ChatTurn[]) {
  const recent = history.slice(-8);
  if (!recent.length) return "No previous messages in this conversation.";
  return recent.map((turn) => `${turn.role === "fan" ? "Fan" : "Persona"}: ${turn.text}`).join("\n");
}

async function retrieveRelevantContext(profile: PersonaProfile, sourceContent: string, query: string, personaId?: string) {
  const storedContext = await retrieveStoredContext(query, personaId);
  if (storedContext) return storedContext;

  const chunks = (profile.retrievalChunks.length ? profile.retrievalChunks : makeFallbackProfile(sourceContent).retrievalChunks)
    .filter(Boolean)
    .slice(0, 24);

  if (!chunks.length) return sourceContent.slice(0, 4000);

  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch(embeddingsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
          input: [query, ...chunks],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const vectors = data.data?.map((item: { embedding: number[] }) => item.embedding) || [];
        const queryVector = vectors[0];
        const scored = chunks.map((chunk, index) => ({
          chunk,
          score: cosineSimilarity(queryVector, vectors[index + 1]),
        }));

        return scored
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map((item) => item.chunk)
          .join("\n\n---\n\n")
          .slice(0, 5000);
      }
    } catch {
      // Fall back to keyword scoring below.
    }
  }

  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3);
  return chunks
    .map((chunk) => ({
      chunk,
      score: terms.reduce((count, term) => count + (chunk.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.chunk)
    .join("\n\n---\n\n")
    .slice(0, 5000);
}

async function retrieveStoredContext(query: string, personaId?: string) {
  if (!process.env.OPENAI_API_KEY || !personaId) return "";

  try {
    const response = await fetch(embeddingsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: query,
      }),
    });
    if (!response.ok) return "";

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    if (!embedding) return "";

    const matches = await supabaseRest<{ content: string; similarity: number }[]>("rpc/match_persona_chunks", {
      method: "POST",
      body: {
        match_persona_id: personaId,
        query_embedding: `[${embedding.join(",")}]`,
        match_count: 5,
      },
    });

    return matches
      .filter((item) => item.content)
      .map((item) => item.content)
      .join("\n\n---\n\n")
      .slice(0, 5000);
  } catch {
    return "";
  }
}

export async function savePersonaEmbeddings(persona: PersonaRecord) {
  if (!process.env.OPENAI_API_KEY || !persona.id) return;

  const profile = normalizeProfile(persona.profile, persona.source_content);
  const chunks = buildRetrievalChunks(persona.source_content || profile.retrievalChunks.join("\n\n")).slice(0, 24);
  if (!chunks.length) return;

  try {
    const response = await fetch(embeddingsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: chunks,
      }),
    });
    if (!response.ok) return;

    const data = await response.json();
    await supabaseRest(`persona_content_chunks?persona_id=eq.${encodeURIComponent(persona.id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    await supabaseRest("persona_content_chunks", {
      method: "POST",
      body: chunks
        .map((chunk, index) => ({
          persona_id: persona.id,
          chunk_index: index,
          content: chunk,
          embedding: Array.isArray(data.data?.[index]?.embedding) ? `[${data.data[index].embedding.join(",")}]` : null,
        }))
        .filter((item) => item.embedding),
      prefer: "return=minimal",
    });
  } catch {
    // Missing pgvector tables should not block persona publishing.
  }
}

function cosineSimilarity(a?: number[], b?: number[]) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aMagnitude += a[index] * a[index];
    bMagnitude += b[index] * b[index];
  }
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude) || 1);
}
