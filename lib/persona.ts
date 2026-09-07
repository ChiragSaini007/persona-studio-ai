export type PersonaProfile = {
  topics: string[];
  phrases: string[];
  tone: string[];
  bio: string;
  fanRelationship: string;
  responseStyle: string;
  greetingStyle: string;
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
    keywords: ["girlfriend", "boyfriend", "address", "family drama", "rumor", "private", "privately"],
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
    greetingStyle:
      "Start casually and warmly. For greetings, say hi back and invite the fan to ask about the creator's approved topics.",
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
    greetingStyle: profile?.greetingStyle || fallback.greetingStyle,
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

export type ChatIntent = "greeting" | "vague" | "question" | "risky";
export type AnswerMode = "chat" | "estimation";
export type ExternalInfoNeed = "none" | "live_public_fact" | "weather" | "currency" | "market";
export type ChatTurn = {
  role: "fan" | "persona";
  text: string;
};

const currentContextPatterns = [
  /\blatest\b/,
  /\brecent\b/,
  /\btoday\b/,
  /\bnow\b/,
  /\bthis week\b/,
  /\bthis month\b/,
  /\bthis year\b/,
  /\b202[4-9]\b/,
  /\bnews\b/,
  /\btrend/,
  /\bgrow/,
  /\bmarket\b/,
  /\bgrowth\b/,
  /\bcompany\b/,
  /\bflood/,
  /\bearthquake/,
  /\bdisaster/,
  /\bdamage\b/,
  /\bloss\b/,
  /\bimpact\b/,
  /\bweather\b/,
  /\btemperature\b/,
  /\bforecast\b/,
  /\brain\b/,
  /\bsnow\b/,
  /\bstorm\b/,
  /\bhumidity\b/,
  /\baqi\b/,
  /\bexchange rate\b/,
  /\bconversion rate\b/,
  /\bcurrency\b/,
  /\busd\b/,
  /\binr\b/,
  /\bnpr\b/,
  /\bconvert\b/,
  /\bprice\b/,
  /\brate\b/,
];

const creatorPrivatePatterns = [
  /\bprivate\b/,
  /\bpersonal\b/,
  /\bphone number\b/,
  /\baddress\b/,
  /\bwhere do you live\b/,
  /\brelationship\b/,
  /\bfamily\b/,
  /\bsecret\b/,
];

const estimationPatterns = [
  /\bestimat/,
  /\bcalculat/,
  /\bhow much\b/,
  /\bdamage\b/,
  /\bloss\b/,
  /\bcost\b/,
  /\bmarket size\b/,
  /\brough number\b/,
  /\brange\b/,
];

export function detectChatIntent(text: string, flagReason = ""): ChatIntent {
  if (flagReason) return "risky";
  const normalized = text.toLowerCase().replace(/[^a-z0-9 ?!]/g, " ").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const greetingWords = ["hi", "hey", "hello", "yo", "sup", "namaste"];
  const startsWithGreeting = words.some((word, index) => index <= 2 && greetingWords.includes(word));
  const socialGreetingPatterns = [
    /how are you/,
    /big fan/,
    /love your work/,
    /good to see you/,
    /nice to meet you/,
  ];
  const asksSubstantiveQuestion = [
    "how do",
    "how should",
    "how can",
    "what should",
    "what is",
    "why",
    "when",
    "where",
    "which",
    "explain",
    "differentiate",
    "learn",
    "build",
  ].some((phrase) => normalized.includes(phrase));
  const isGreeting =
    (words.length <= 4 && words.some((word) => greetingWords.includes(word))) ||
    ((startsWithGreeting || words.length <= 5) &&
      !asksSubstantiveQuestion &&
      socialGreetingPatterns.some((pattern) => pattern.test(normalized)));
  if (isGreeting) return "greeting";
  if (words.length < 4 && !normalized.includes("?")) return "vague";
  return "question";
}

export function detectChatIntentWithHistory(text: string, flagReason = "", history: ChatTurn[] = []): ChatIntent {
  const intent = detectChatIntent(text, flagReason);
  if (intent !== "vague" || flagReason || !history.length) return intent;

  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
  const contextualFragments = [
    "target market",
    "customer",
    "users",
    "competitors",
    "competition",
    "pricing",
    "business model",
    "value proposition",
    "roadmap",
    "execution",
    "growth",
    "distribution",
    "retention",
    "strategy",
    "metrics",
    "unit economics",
  ];
  const recentContext = history
    .slice(-6)
    .map((turn) => turn.text)
    .join(" ")
    .toLowerCase();
  const hasActiveCaseStudy = /\b(case study|case|framework|break this down|step by step|zepto|business strategy)\b/.test(
    recentContext,
  );
  const isContextualFragment = contextualFragments.some((fragment) => normalized === fragment || normalized.includes(fragment));

  return hasActiveCaseStudy && isContextualFragment ? "question" : intent;
}

export function detectExternalInfoNeed(text: string, intent: ChatIntent, flagReason = ""): ExternalInfoNeed {
  if (intent !== "question" || flagReason) return "none";

  const normalized = text.toLowerCase();
  if (creatorPrivatePatterns.some((pattern) => pattern.test(normalized))) return "none";
  if (/\btarget market\b|\bcustomer segment\b|\bideal customer\b|\buser segment\b/.test(normalized)) return "none";

  if (/\bweather\b|\btemperature\b|\bforecast\b|\brain\b|\bsnow\b|\bstorm\b|\bhumidity\b|\baqi\b/.test(normalized)) {
    return "weather";
  }

  if (
    /\bexchange rate\b|\bconversion rate\b|\bcurrency\b|\bconvert\b/.test(normalized) ||
    (/\b(usd|inr|npr|eur|gbp|aed|sgd)\b/.test(normalized) && /\b(rate|price|worth|to|in)\b/.test(normalized))
  ) {
    return "currency";
  }

  if (/\bstock\b|\bmarket price\b|\bmarket rate\b|\bprice\b|\brate\b|\bcrypto\b|\bbitcoin\b|\beth\b/.test(normalized)) {
    return "market";
  }

  return currentContextPatterns.some((pattern) => pattern.test(normalized)) ? "live_public_fact" : "none";
}

function keywordOverlapCount(text: string, context: string) {
  const terms = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);
  return terms.filter((term) => context.toLowerCase().includes(term)).length;
}

function personaContextText(profile: PersonaProfile, sourceContent = "", retrievedContext = "") {
  return [
    profile.bio,
    profile.fanRelationship,
    profile.responseStyle,
    profile.topics.join(" "),
    profile.phrases.join(" "),
    profile.tone.join(" "),
    profile.exampleReplies.join(" "),
    profile.retrievalChunks.join(" "),
    sourceContent,
    retrievedContext,
  ].join(" ");
}

export function isExternalInfoAllowedForPersona(
  text: string,
  externalInfoNeed: ExternalInfoNeed,
  profile: PersonaProfile,
  sourceContent = "",
  retrievedContext = "",
) {
  if (externalInfoNeed === "none") return false;

  const normalized = text.toLowerCase();
  const personaContext = personaContextText(profile, sourceContent, retrievedContext).toLowerCase();
  const overlapCount = keywordOverlapCount(text, personaContext);

  if (externalInfoNeed === "weather") {
    const weatherRelevantPersona = /\b(weather|travel|trip|tour|outdoor|fitness|running|walking|sports|event|venue|city guide)\b/.test(
      personaContext,
    );
    const weatherRelevantQuestion = /\b(run|walk|workout|travel|trip|tour|event|venue|shoot|commute|flight|flood|storm)\b/.test(
      normalized,
    );
    return weatherRelevantPersona && weatherRelevantQuestion;
  }

  if (externalInfoNeed === "currency") {
    const currencyRelevantPersona =
      /\b(finance|fintech|payments|business|commerce|startup|market|monetization|revenue|pricing|investment|travel)\b/.test(
        personaContext,
      );
    const currencyRelevantQuestion = /\b(estimate|damage|loss|cost|revenue|pricing|market|business|budget|travel|invoice)\b/.test(
      normalized,
    );
    return currencyRelevantPersona || currencyRelevantQuestion;
  }

  if (externalInfoNeed === "market") {
    return /\b(finance|fintech|business|commerce|startup|market|monetization|revenue|pricing|crypto|stock|investment)\b/.test(
      personaContext,
    );
  }

  if (
    /\b(company|startup|growth|grow|trend|news|market|business|creator|youtube|instagram|tiktok|ai|product)\b/.test(normalized) &&
    /\b(company|startup|growth|distribution|trend|market|business|creator|youtube|instagram|tiktok|ai|product)\b/.test(
      personaContext,
    )
  ) {
    return true;
  }

  return overlapCount >= 1;
}

export function shouldUseWebSearch(text: string, intent: ChatIntent, flagReason: string, retrievedContext = "") {
  if (intent !== "question" || flagReason) return false;

  const normalized = text.toLowerCase();
  if (creatorPrivatePatterns.some((pattern) => pattern.test(normalized))) return false;

  const asksForCurrentPublicContext = currentContextPatterns.some((pattern) => pattern.test(normalized));
  const contextTerms = normalized
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);
  const contextMatches = contextTerms.filter((term) => retrievedContext.toLowerCase().includes(term)).length;
  const hasEnoughCreatorContext = retrievedContext.length > 240 && contextMatches >= 2;

  return (asksForCurrentPublicContext || detectExternalInfoNeed(text, intent, flagReason) !== "none") && !hasEnoughCreatorContext;
}

export function shouldUseWebSearchForPersona(
  text: string,
  intent: ChatIntent,
  flagReason: string,
  retrievedContext: string,
  profile: PersonaProfile,
  sourceContent = "",
) {
  const externalInfoNeed = detectExternalInfoNeed(text, intent, flagReason);
  return (
    shouldUseWebSearch(text, intent, flagReason, retrievedContext) &&
    isExternalInfoAllowedForPersona(text, externalInfoNeed, profile, sourceContent, retrievedContext)
  );
}

export function detectAnswerMode(text: string, intent: ChatIntent) {
  if (intent !== "question") return "chat";
  const normalized = text.toLowerCase();
  return estimationPatterns.some((pattern) => pattern.test(normalized)) ? "estimation" : "chat";
}

export function buildLocalReply(persona: PersonaRecord, text: string, flagReason: string) {
  const intent = detectChatIntent(text, flagReason);
  if (flagReason) return persona.fallback_text;
  if (intent === "greeting") {
    const firstName = persona.creator_name.split(" ")[0] || "there";
    return `Hey, appreciate you. What do you want to talk about with ${firstName} today?`;
  }
  if (intent === "vague") {
    return "I’m not fully sure what you mean. Ask me like you would in a DM, and I’ll take it from there.";
  }
  return "I’m having trouble pulling the creator-approved answer right now. Try again in a moment.";
}
