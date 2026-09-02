export type PersonaProfile = {
  topics: string[];
  phrases: string[];
  tone: string[];
  bio: string;
  fanRelationship: string;
  responseStyle: string;
  exampleReplies: string[];
  neverSay: string[];
  retrievalChunks: string[];
};

export type PersonaRecord = {
  id?: string;
  creator_user_id?: string | null;
  creator_name: string;
  creator_handle: string;
  source_content: string;
  profile: PersonaProfile;
  enabled_guardrails: Record<string, boolean>;
  custom_boundary: string;
  fallback_text: string;
  monetization: "free" | "pay_per_conversation";
  price_cents: number;
  status: "draft" | "live" | "paused";
};

export type Guardrail = {
  key: string;
  title: string;
  description: string;
  keywords: string[];
  locked?: boolean;
};

export const guardrails: Guardrail[] = [
  {
    key: "identity",
    title: "Real-person deception",
    description: "Claims that the AI is the actual creator or can speak with real-time authority.",
    keywords: ["are you real", "is this really", "prove you are", "call me", "meet me"],
    locked: true,
  },
  {
    key: "medical",
    title: "Medical advice",
    description: "Diagnosis, medication, symptoms, treatment, or health-risk decisions.",
    keywords: ["diagnose", "medicine", "symptom", "treatment", "doctor", "medication"],
    locked: true,
  },
  {
    key: "financial",
    title: "Financial advice",
    description: "Investment picks, crypto trades, portfolio recommendations, or loan decisions.",
    keywords: ["stock", "crypto", "invest", "portfolio", "loan", "buy bitcoin"],
    locked: true,
  },
  {
    key: "legal",
    title: "Legal advice",
    description: "Contracts, lawsuits, liability, or legal strategy.",
    keywords: ["lawsuit", "contract", "sue", "liable", "legal advice"],
    locked: true,
  },
  {
    key: "politics",
    title: "Politics",
    description: "Parties, candidates, voting advice, or ideological persuasion.",
    keywords: ["election", "vote", "party", "president", "politics"],
  },
  {
    key: "personal",
    title: "Private personal life",
    description: "Family, relationships, private addresses, or unauthenticated gossip.",
    keywords: ["girlfriend", "boyfriend", "address", "family drama", "rumor"],
  },
];

export function cleanHandle(handle: string) {
  const cleaned = handle.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  return cleaned.replace(/^-|-$/g, "") || "creator";
}

export function makeFallbackProfile(content: string): PersonaProfile {
  const lower = content.toLowerCase();
  const topics = [
    ["Creator economy", "creator"],
    ["AI products", "ai"],
    ["Product strategy", "product"],
    ["Monetization", "pay"],
    ["Community building", "community"],
    ["Commerce infrastructure", "commerce"],
  ]
    .filter(([, token]) => lower.includes(token))
    .map(([topic]) => topic);

  return {
    topics: topics.length ? topics : ["Creator economy", "AI products", "Product strategy"],
    phrases: ["Real talk", "My honest view", "Who feels the pain?", "What keeps this defensible?"],
    tone: ["Direct", "Strategic", "Commercially minded", "Warm but controlled"],
    bio:
      "Product and business builder focused on AI products, creator economy infrastructure, growth, and practical startup strategy.",
    fanRelationship:
      "Fans come for direct, useful advice that feels like a thoughtful voice note from the creator.",
    responseStyle:
      "Answer in a natural first-person voice. Be concise, opinionated, warm, and practical. Use creator phrases when they fit, but do not force them.",
    exampleReplies: [
      "Real talk, start with the pain people already feel. If the answer does not improve trust, distribution, or retention, it is probably a feature pretending to be a business.",
      "My honest view is that the first version should be useful, narrow, and easy to repeat. Fancy comes later.",
      "I would ask: who feels this problem, who pays, and what keeps working even when the novelty fades?",
    ],
    neverSay: [
      "I can meet you privately.",
      "This is definitely what I did today.",
      "You should make a legal, medical, or investment decision based on this.",
    ],
    retrievalChunks: buildRetrievalChunks(content),
  };
}

export function normalizeProfile(profile?: Partial<PersonaProfile> | null, content = ""): PersonaProfile {
  const fallback = makeFallbackProfile(content);
  return {
    topics: profile?.topics?.length ? profile.topics : fallback.topics,
    phrases: profile?.phrases?.length ? profile.phrases : fallback.phrases,
    tone: profile?.tone?.length ? profile.tone : fallback.tone,
    bio: profile?.bio || fallback.bio,
    fanRelationship: profile?.fanRelationship || fallback.fanRelationship,
    responseStyle: profile?.responseStyle || fallback.responseStyle,
    exampleReplies: profile?.exampleReplies?.length ? profile.exampleReplies : fallback.exampleReplies,
    neverSay: profile?.neverSay?.length ? profile.neverSay : fallback.neverSay,
    retrievalChunks: profile?.retrievalChunks?.length ? profile.retrievalChunks : fallback.retrievalChunks,
  };
}

export function buildRetrievalChunks(content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!paragraphs.length) return [];

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > 900 && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks.slice(0, 24);
}

export function findFlag(persona: Pick<PersonaRecord, "enabled_guardrails" | "custom_boundary" | "profile">, text: string) {
  const lower = text.toLowerCase();
  const matched = guardrails.find(
    (rail) => persona.enabled_guardrails[rail.key] && rail.keywords.some((keyword) => lower.includes(keyword)),
  );

  if (matched) return matched.title;
  const neverSayMatch = normalizeProfile(persona.profile).neverSay.find((item) => {
    const keyTerms = item
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 4);
    return keyTerms.length >= 2 && keyTerms.slice(0, 4).every((word) => lower.includes(word));
  });
  if (neverSayMatch) return "Creator never-say rule";
  if (persona.custom_boundary && lower.includes(persona.custom_boundary.toLowerCase())) return persona.custom_boundary;
  if (lower.includes("real creator") || lower.includes("secret")) return "Creator-approved boundary";
  return "";
}

export function buildLocalReply(persona: PersonaRecord, text: string, flagReason: string) {
  if (flagReason) return persona.fallback_text;
  const topic = persona.profile.topics.find((item) => text.toLowerCase().includes(item.toLowerCase().split(" ")[0]));
  const opener = persona.profile.phrases[0] || "Honestly";
  const subject = topic ? topic.toLowerCase() : "that";
  return `${opener}, I would keep ${subject} simple. Start with the real problem, say what you believe clearly, and make the next step useful enough that people want to come back.`;
}
