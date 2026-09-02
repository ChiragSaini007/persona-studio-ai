export type PersonaProfile = {
  topics: string[];
  phrases: string[];
  tone: string[];
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
  };
}

export function findFlag(persona: Pick<PersonaRecord, "enabled_guardrails" | "custom_boundary">, text: string) {
  const lower = text.toLowerCase();
  const matched = guardrails.find(
    (rail) => persona.enabled_guardrails[rail.key] && rail.keywords.some((keyword) => lower.includes(keyword)),
  );

  if (matched) return matched.title;
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
