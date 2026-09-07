import {
  buildLocalReply,
  buildRetrievalChunks,
  detectAnswerMode,
  detectChatIntentWithHistory,
  detectExternalInfoNeed,
  makeFallbackProfile,
  normalizeProfile,
  ChatTurn,
  PersonaRecord,
  PersonaProfile,
  resolveQuestionWithHistory,
  shouldUseWebSearchForPersona,
} from "./persona";
import { supabaseRest } from "./supabase-rest";

const openaiUrl = "https://api.openai.com/v1/responses";
const moderationUrl = "https://api.openai.com/v1/moderations";
const embeddingsUrl = "https://api.openai.com/v1/embeddings";
const defaultTextModels = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-mini"];

export function hasOpenAIConfig() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function textModelCandidates() {
  return Array.from(new Set([process.env.OPENAI_MODEL, ...defaultTextModels].filter(Boolean))) as string[];
}

function extractOutputText(data: { output_text?: string; output?: { content?: { text?: string }[] }[] }) {
  return (
    data.output_text ||
    data.output?.flatMap((item) => item.content || []).find((item) => typeof item.text === "string")?.text ||
    ""
  );
}

function cleanChatReply(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/([^\n])\s+(\d+\.\s)/g, "$1\n\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function answerTokenBudget(answerMode: string, allowWebSearch: boolean, resolvedQuestion: string) {
  const asksForFullCase = /\b(complete|full|deep|case study|business case|with numbers|numbers|metrics)\b/i.test(resolvedQuestion);
  if (answerMode === "estimation" || allowWebSearch || asksForFullCase) return 950;
  return 620;
}

async function createResponse(body: Record<string, unknown>) {
  let lastError = "";

  for (const model of textModelCandidates()) {
    try {
      const response = await fetch(openaiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, model }),
      });

      if (!response.ok) {
        lastError = `${model}: ${response.status} ${await response.text()}`;
        continue;
      }

      const data = await response.json();
      return { data, model, error: "" };
    } catch (error) {
      lastError = `${model}: ${error instanceof Error ? error.message : "OpenAI request failed"}`;
    }
  }

  return { data: null, model: "", error: lastError || "OpenAI request failed" };
}

function countWebSearchCalls(data: { output?: { type?: string }[] } | null) {
  return data?.output?.filter((item) => item.type === "web_search_call").length || 0;
}

export async function generateProfileWithAI(content: string): Promise<{ profile: PersonaProfile; usedAI: boolean }> {
  if (!process.env.OPENAI_API_KEY) {
    return { profile: makeFallbackProfile(content), usedAI: false };
  }

  const { data } = await createResponse({
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
  });

  if (!data) return { profile: makeFallbackProfile(content), usedAI: false };
  const text = extractOutputText(data);

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

export async function generateChatReply(persona: PersonaRecord, text: string, flagReason: string, history: ChatTurn[] = []) {
  const profile = normalizeProfile(persona.profile, persona.source_content);
  const intent = detectChatIntentWithHistory(text, flagReason, history);
  const resolvedQuestion = resolveQuestionWithHistory(text, intent, history);
  const retrieval = await retrieveRelevantContext(profile, persona.source_content, resolvedQuestion, persona.id);
  const answerMode = detectAnswerMode(resolvedQuestion, intent);
  const externalInfoNeed = detectExternalInfoNeed(resolvedQuestion, intent, flagReason);
  const allowWebSearch = shouldUseWebSearchForPersona(
    resolvedQuestion,
    intent,
    flagReason,
    retrieval.context,
    profile,
    persona.source_content,
  );
  const baseMetadata = {
    intent,
    answerMode,
    externalInfoNeed,
    resolvedQuestion,
    usedRAG: retrieval.chunkCount > 0,
    retrievedChunkCount: retrieval.chunkCount,
    usedWeb: false,
    webSourceCount: 0,
  };
  if (flagReason) {
    return { reply: buildLocalReply({ ...persona, profile }, text, flagReason), usedAI: false, ...baseMetadata };
  }
  if (intent === "greeting" || intent === "vague") {
    return { reply: buildLocalReply({ ...persona, profile }, text, flagReason), usedAI: false, ...baseMetadata };
  }
  if (externalInfoNeed !== "none" && !allowWebSearch) {
    return {
      reply: buildOutOfScopeLiveInfoReply(persona, profile, externalInfoNeed),
      usedAI: false,
      ...baseMetadata,
      externalInfoAllowed: false,
    };
  }
  if (!process.env.OPENAI_API_KEY) {
    return {
      reply: buildLocalReply({ ...persona, profile }, text, flagReason),
      usedAI: false,
      ...baseMetadata,
      runtimeError: "OpenAI API key is not configured",
    };
  }

  const maxOutputTokens = answerTokenBudget(answerMode, allowWebSearch, resolvedQuestion);
  let responseResult = await createResponse({
    ...(allowWebSearch
      ? {
          tools: [{ type: "web_search_preview", search_context_size: "low" }],
          tool_choice: "required",
          include: ["web_search_call.action.sources"],
        }
      : {}),
    input: [
        {
          role: "system",
          content: [
            `You are ${persona.creator_name}'s AI persona for fan conversations.`,
            "The page already discloses that this is AI. In the conversation, write naturally in the creator's first-person voice when appropriate.",
            "Sound like the creator's public persona: warm, direct, familiar, and conversational.",
            `Detected fan intent: ${intent}.`,
            `Answer mode: ${answerMode}.`,
            `Resolved fan question: ${resolvedQuestion}`,
            resolvedQuestion !== text
              ? "The latest fan message is a short follow-up. Answer the resolved fan question, but keep the wording natural and conversational."
              : "",
            "If the fan is greeting you, reply with a short warm greeting and invite a real question. Do not give advice.",
            "If the fan is vague, ask one short follow-up question. Do not guess what they meant.",
            "If the fan asks a real question, answer directly using the creator profile, examples, chat context, and retrieved creator context.",
            allowWebSearch
              ? `Web search is enabled for this turn because the fan needs live public information. External info type: ${externalInfoNeed}. Use web results for the factual part, then answer through the creator's lens. Do not say you lack real-time data if web results are available.`
              : "Web search is disabled for this turn. Do not pretend to know current facts that are not in the provided context.",
            externalInfoNeed === "weather"
              ? "For weather: answer with current public weather for the clearest location in the fan's message. If the location is broad, say it varies by city and give the best representative location or ask one short follow-up if no useful location exists."
              : "",
            externalInfoNeed === "currency"
              ? "For currency or exchange rates: use current public exchange-rate context, state the approximate rate, show the conversion math if an amount is present, and keep it concise."
              : "",
            externalInfoNeed === "market"
              ? "For market prices or rates: use current public context for factual price/rate information, but do not give investment advice or tell the fan what to buy."
              : "",
            externalInfoNeed === "live_public_fact"
              ? "For live public facts: use current public sources for the changing facts, then explain the implication in the creator's normal style."
              : "",
            answerMode === "estimation"
              ? "The fan is asking for an estimate or calculation. Give a useful rough range with explicit assumptions, simple math, and confidence level. Do not answer with only 'look up reports' or generic research advice."
              : "The fan is asking for a normal chat answer. Be direct and useful.",
            answerMode === "estimation"
              ? "For estimation: define the scope, list 3-5 drivers, show an example calculation, give low/base/high ranges when possible, and convert currencies if the user asks."
              : "Avoid over-structuring casual answers.",
            "Format for a chat bubble, not an article. Use 2-4 short paragraphs or a short numbered list with each point on its own line.",
            "For number-heavy case studies, give the most important 5-7 numbers, explain why each matters, and stop cleanly with a next section suggestion.",
            "Do not use Markdown bold, headings, tables, or long uninterrupted blocks of text.",
            "Keep the answer complete. Do not start a numbered list unless you can finish every item.",
            "Do not end mid-sentence. If space is limited, summarize fewer points instead of continuing a long list.",
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
            `Retrieved creator context:\n${retrieval.context}`,
          ].join("\n"),
        },
        { role: "user", content: resolvedQuestion },
      ],
      max_output_tokens: maxOutputTokens,
  });

  if (!responseResult.data && allowWebSearch) {
    responseResult = await createResponse({
      input: [
          {
            role: "system",
            content: [
              `You are ${persona.creator_name}'s AI persona for fan conversations.`,
              "The page already discloses that this is AI. In the conversation, write naturally in the creator's first-person voice when appropriate.",
              "Web search was attempted but unavailable. Answer only from the creator profile, chat context, and retrieved creator context.",
              answerMode === "estimation"
                ? "The fan is asking for an estimate. Build a rough model with assumptions from the available context, state that current public facts are not available, and show how to estimate rather than sending the fan away."
                : "If current public facts are required and not available, say that the approved context does not contain the latest details and answer the durable part only.",
              "Do not use Markdown bold, headings, tables, or long uninterrupted blocks of text.",
              "Never claim to be the actual human, never claim real-time personal access, and never invent private facts.",
              `Fallback: ${persona.fallback_text}`,
              `Creator bio: ${profile.bio}`,
              `Fan relationship: ${profile.fanRelationship}`,
              `Response style: ${profile.responseStyle}`,
              `Ideal example replies:\n${profile.exampleReplies.map((item) => `- ${item}`).join("\n")}`,
              `Approved topics: ${profile.topics.join(", ")}`,
              `Recent chat context:\n${formatChatContext(history)}`,
              `Retrieved creator context:\n${retrieval.context}`,
            ].join("\n"),
          },
          { role: "user", content: resolvedQuestion },
        ],
        max_output_tokens: maxOutputTokens,
    });
  }

  const reply = responseResult.data ? cleanChatReply(extractOutputText(responseResult.data)) : "";
  if (!reply) {
    return {
      reply: buildLocalReply({ ...persona, profile }, text, flagReason),
      usedAI: false,
      ...baseMetadata,
      runtimeError: responseResult.error || "OpenAI returned an empty answer",
    };
  }

  const webSourceCount = countWebSearchCalls(responseResult.data);
  return { reply, usedAI: true, model: responseResult.model, ...baseMetadata, usedWeb: webSourceCount > 0, webSourceCount };
}

function buildOutOfScopeLiveInfoReply(
  persona: Pick<PersonaRecord, "creator_name" | "fallback_text">,
  profile: PersonaProfile,
  externalInfoNeed: string,
) {
  const firstName = persona.creator_name.split(" ")[0] || "the creator";
  const topics = profile.topics.slice(0, 3).join(", ");
  const liveInfoLabel =
    externalInfoNeed === "weather"
      ? "live weather"
      : externalInfoNeed === "currency"
        ? "live currency rates"
        : externalInfoNeed === "market"
          ? "live market data"
          : "live public information";

  return `I can’t turn this into a general ${liveInfoLabel} lookup from ${firstName}'s persona. Ask me something that connects to ${topics || "the creator's approved topics"}, and I’ll use current context where it genuinely helps.`;
}

function formatChatContext(history: ChatTurn[]) {
  const recent = history.slice(-8);
  if (!recent.length) return "No previous messages in this conversation.";
  return recent.map((turn) => `${turn.role === "fan" ? "Fan" : "Persona"}: ${turn.text}`).join("\n");
}

async function retrieveRelevantContext(profile: PersonaProfile, sourceContent: string, query: string, personaId?: string) {
  const storedContext = await retrieveStoredContext(query, personaId);
  if (storedContext) return { context: storedContext, chunkCount: storedContext.split("\n\n---\n\n").filter(Boolean).length };

  const chunks = (profile.retrievalChunks.length ? profile.retrievalChunks : makeFallbackProfile(sourceContent).retrievalChunks)
    .filter(Boolean)
    .slice(0, 24);

  if (!chunks.length) return { context: sourceContent.slice(0, 4000), chunkCount: sourceContent ? 1 : 0 };

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

        const context = scored
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map((item) => item.chunk)
          .join("\n\n---\n\n")
          .slice(0, 5000);
        return { context, chunkCount: context ? context.split("\n\n---\n\n").filter(Boolean).length : 0 };
      }
    } catch {
      // Fall back to keyword scoring below.
    }
  }

  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3);
  const context = chunks
    .map((chunk) => ({
      chunk,
      score: terms.reduce((count, term) => count + (chunk.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.chunk)
    .join("\n\n---\n\n")
    .slice(0, 5000);
  return { context, chunkCount: context ? context.split("\n\n---\n\n").filter(Boolean).length : 0 };
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
