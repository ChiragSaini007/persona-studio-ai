"use client";

import { useEffect, useMemo, useState } from "react";

export type PersonaStatus = "draft" | "live" | "paused";
export type MonetizationMode = "free" | "pay_per_conversation";

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

export type Message = {
  id: string;
  from: "fan" | "persona";
  text: string;
  flagged?: boolean;
  flagReason?: string;
  usedWeb?: boolean;
  sourceCount?: number;
};

export type Conversation = {
  id: string;
  paid: boolean;
  messages: Message[];
};

export type PersonaWorkspace = {
  creatorName: string;
  creatorHandle: string;
  content: string;
  profile: PersonaProfile;
  enabledGuardrails: Record<string, boolean>;
  customBoundary: string;
  fallbackText: string;
  monetization: MonetizationMode;
  price: number;
  status: PersonaStatus;
  returningFans: number;
  conversations: Conversation[];
};

export type Guardrail = {
  key: string;
  title: string;
  description: string;
  keywords: string[];
  locked?: boolean;
};

export const sampleContent = `I have been thinking a lot about how creators build durable communities, not just audiences. The best creator businesses feel like operating systems: content, trust, commerce, data, and rewards all working together.

Real talk, AI should not replace the creator's judgment. It should extend their ability to respond, teach, entertain, and listen while keeping control close to the person whose reputation is on the line.

When people ask me about product strategy, I usually come back to the same questions: who feels the pain, who pays, why now, and what keeps this defensible if it works?

The creator economy is moving from campaign thinking to infrastructure thinking. Discovery, onboarding, attribution, payouts, loyalty, and analytics are becoming the real product surface.

My honest view: a product is only as good as the business system around it. Distribution, retention, willingness to pay, and operational trust matter as much as the feature set.`;

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

export const uid = () => Math.random().toString(36).slice(2, 10);

export function cleanHandle(handle: string) {
  const cleaned = handle.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  return cleaned.replace(/^-|-$/g, "") || "creator";
}

export function makePersonaProfile(content: string): PersonaProfile {
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

export function normalizePersonaProfile(profile?: Partial<PersonaProfile> | null, content = ""): PersonaProfile {
  const fallback = makePersonaProfile(content);
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

export function defaultWorkspace(): PersonaWorkspace {
  return {
    creatorName: "Chirag Saini",
    creatorHandle: "@chirag",
    content: sampleContent,
    profile: makePersonaProfile(sampleContent),
    enabledGuardrails: Object.fromEntries(guardrails.map((rail) => [rail.key, true])),
    customBoundary: "competitor claims",
    fallbackText:
      "I cannot speak to that one. It is outside the boundaries this AI persona is approved to discuss, so please check the creator's official channels for their real view.",
    monetization: "free",
    price: 3,
    status: "draft",
    returningFans: 1,
    conversations: [
      {
        id: uid(),
        paid: false,
        messages: [
          { id: uid(), from: "fan", text: "How should I think about building a creator product?" },
          {
            id: uid(),
            from: "persona",
            text: "Real talk, start with the creator's operating reality. If it does not improve trust, monetization, or repeat engagement, it is probably a feature pretending to be a business.",
          },
        ],
      },
    ],
  };
}

const storageKey = "persona-studio-workspace";

export function usePersonaWorkspace() {
  const [workspace, setWorkspace] = useState<PersonaWorkspace>(() => defaultWorkspace());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<PersonaWorkspace>;
      queueMicrotask(() =>
        setWorkspace({
          ...defaultWorkspace(),
          ...parsed,
          profile: normalizePersonaProfile(parsed.profile, parsed.content),
        }),
      );
    }
    queueMicrotask(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(storageKey, JSON.stringify(workspace));
  }, [loaded, workspace]);

  const analytics = useMemo(() => {
    const fanMessages = workspace.conversations.flatMap((conversation) =>
      conversation.messages.filter((message) => message.from === "fan"),
    );
    const flagged = workspace.conversations.flatMap((conversation) =>
      conversation.messages.filter((message) => message.flagged),
    );
    const revenue = workspace.conversations.filter((conversation) => conversation.paid).length * workspace.price;
    const topicCounts = workspace.profile.topics.map((topic) => ({
      topic,
      count: fanMessages.filter((message) => message.text.toLowerCase().includes(topic.toLowerCase().split(" ")[0]))
        .length,
    }));

    return {
      conversations: workspace.conversations.length,
      fanMessages: fanMessages.length,
      flagged,
      fallbackRate: fanMessages.length ? Math.round((flagged.length / fanMessages.length) * 100) : 0,
      returnRate: workspace.conversations.length
        ? Math.round((workspace.returningFans / Math.max(workspace.conversations.length, 1)) * 100)
        : 0,
      revenue,
      topicCounts,
    };
  }, [workspace]);

  return { workspace, setWorkspace, analytics, loaded };
}

export function findFlag(workspace: PersonaWorkspace, text: string) {
  const lower = text.toLowerCase();
  const matched = guardrails.find(
    (rail) => workspace.enabledGuardrails[rail.key] && rail.keywords.some((keyword) => lower.includes(keyword)),
  );

  if (matched) return matched.title;
  const neverSayMatch = workspace.profile.neverSay.find((item) => {
    const keyTerms = item
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 4);
    return keyTerms.length >= 2 && keyTerms.slice(0, 4).every((word) => lower.includes(word));
  });
  if (neverSayMatch) return "Creator never-say rule";
  if (workspace.customBoundary && lower.includes(workspace.customBoundary.toLowerCase())) return workspace.customBoundary;
  if (lower.includes("real creator") || lower.includes("secret")) return "Creator-approved boundary";
  return "";
}

export type ChatIntent = "greeting" | "vague" | "question" | "off_topic" | "identity_confusion" | "risky";
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
  /\bnumber/,
  /\bmetric/,
  /\buser growth\b/,
  /\brevenue\b/,
  /\bgmv\b/,
  /\border volume\b/,
  /\bmarket share\b/,
  /\bvaluation\b/,
  /\bfunding\b/,
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

const genericStopwords = new Set([
  "about",
  "after",
  "again",
  "anything",
  "around",
  "because",
  "before",
  "being",
  "better",
  "could",
  "discuss",
  "explain",
  "first",
  "from",
  "have",
  "learn",
  "like",
  "more",
  "should",
  "something",
  "that",
  "their",
  "there",
  "these",
  "thing",
  "think",
  "this",
  "want",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

const celebrityCreditPatterns = [
  /\b(loved|love|liked|watched|saw)\s+(your|ur)\s+(movie|film|show|series|song|album|concert|match|game|podcast|book)\b/,
  /\b(your|ur)\s+(movie|film|show|series|song|album|concert|match|game|podcast|book)\b/,
  /\b(are you|is this)\s+(the\s+)?(actor|actress|singer|musician|cricketer|footballer|celebrity)\b/,
];

function normalizedWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !genericStopwords.has(word));
}

function significantTerms(text: string) {
  return Array.from(new Set(normalizedWords(text)));
}

function profileDomainText(profile: PersonaProfile, sourceContent = "", retrievedContext = "") {
  return [
    profile.bio,
    profile.fanRelationship,
    profile.responseStyle,
    profile.greetingStyle,
    profile.topics.join(" "),
    profile.phrases.join(" "),
    profile.tone.join(" "),
    profile.exampleReplies.join(" "),
    profile.retrievalChunks.join(" "),
    sourceContent,
    retrievedContext,
  ].join(" ");
}

export function detectIdentityConfusion(text: string, profile: PersonaProfile, sourceContent = "") {
  const normalized = text.toLowerCase();
  if (!celebrityCreditPatterns.some((pattern) => pattern.test(normalized))) return false;

  const domain = profileDomainText(profile, sourceContent).toLowerCase();
  const creditedTerms = ["movie", "film", "show", "series", "song", "album", "concert", "match", "game", "podcast", "book"];
  return !creditedTerms.some((term) => normalized.includes(term) && domain.includes(term));
}

export function isQuestionInPersonaDomain(
  text: string,
  profile: PersonaProfile,
  sourceContent = "",
  retrievedContext = "",
  history: ChatTurn[] = [],
) {
  const normalized = text.toLowerCase();
  const domain = profileDomainText(profile, sourceContent, retrievedContext).toLowerCase();
  const terms = significantTerms(text);
  const overlapCount = terms.filter((term) => domain.includes(term)).length;
  const hasBusinessPersona = /\b(product|business|startup|growth|market|strategy|revenue|distribution|metrics|commerce|fintech|payments)\b/.test(
    domain,
  );
  const externalInfoNeed = detectExternalInfoNeed(text, "question");

  if (overlapCount >= 1) return true;
  if (externalInfoNeed !== "none" && isExternalInfoAllowedForPersona(text, externalInfoNeed, profile, sourceContent, retrievedContext)) {
    return true;
  }
  if (estimationPatterns.some((pattern) => pattern.test(normalized)) && hasBusinessPersona) return true;
  if (/\b(case study|business case|strategy|growth|market|pricing|revenue|users|metrics|product|startup)\b/.test(normalized)) {
    return hasBusinessPersona;
  }
  if (history.length && /\b(target market|pricing|user growth|competition|business model|value proposition|roadmap)\b/.test(normalized)) {
    return true;
  }

  return false;
}

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

export function classifyPersonaMessage(
  text: string,
  profile: PersonaProfile,
  sourceContent = "",
  flagReason = "",
  history: ChatTurn[] = [],
) {
  const intent = detectChatIntentWithHistory(text, flagReason, history);
  if (intent === "risky" || intent === "vague") return intent;
  if (detectIdentityConfusion(text, profile, sourceContent)) return "identity_confusion";
  if (intent === "question" && !isQuestionInPersonaDomain(text, profile, sourceContent, "", history)) return "off_topic";
  return intent;
}

function activeCaseSubject(history: ChatTurn[]) {
  const recent = history
    .slice(-8)
    .map((turn) => turn.text)
    .join("\n");
  const patterns = [
    /\b(?:case study|business case|case)\s+(?:on|of|for|about)\s+([A-Z][A-Za-z0-9&.-]{1,30})/i,
    /\b(?:let'?s|lets)\s+(?:do|discuss)\s+(?:a\s+)?(?:live\s+)?(?:business\s+)?case(?:\s+study)?\s+(?:on|of|for|about)\s+([A-Z][A-Za-z0-9&.-]{1,30})/i,
  ];

  for (let index = patterns.length - 1; index >= 0; index -= 1) {
    const match = recent.match(patterns[index]);
    if (match?.[1]) return match[1].replace(/[?.!,]+$/, "");
  }

  return "";
}

export function resolveQuestionWithHistory(text: string, intent: ChatIntent, history: ChatTurn[] = []) {
  if (intent !== "question" || !history.length) return text;

  const subject = activeCaseSubject(history);
  if (!subject) return text;

  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
  const shortFollowUp = normalized.split(/\s+/).filter(Boolean).length <= 7;

  if (/\bnumber|\bmetric|\bdata|\bfigure|\bstat/.test(normalized)) {
    return `In the ${subject} business case, explain this with concrete recent numbers and what those numbers mean: ${text}`;
  }

  if (shortFollowUp) {
    return `In the ${subject} business case, explain ${text} with concrete examples, relevant numbers if available, and product/business implications.`;
  }

  return text;
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
  const asksForSpecificExternalData =
    /\b(number|numbers|metric|metrics|data|figure|figures|stat|stats|user growth|revenue|gmv|orders|order volume|market share|valuation|funding)\b/.test(
      normalized,
    );
  const contextTerms = normalized
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);
  const contextMatches = contextTerms.filter((term) => retrievedContext.toLowerCase().includes(term)).length;
  const hasEnoughCreatorContext = retrievedContext.length > 240 && contextMatches >= 2 && !asksForSpecificExternalData;

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

export function generatePersonaReply(workspace: PersonaWorkspace, text: string, flagReason: string) {
  const intent = classifyPersonaMessage(text, workspace.profile, workspace.content, flagReason);
  if (flagReason) return workspace.fallbackText;
  if (intent === "identity_confusion") {
    const firstName = workspace.creatorName.split(" ")[0] || "the creator";
    const topics = workspace.profile.topics.slice(0, 3).join(", ").toLowerCase();
    return `Appreciate the love, but I may not be the person you meant. I’m ${firstName}'s AI persona, built around their public work on ${topics}. Want to ask me something in that lane?`;
  }
  if (intent === "off_topic") {
    const firstName = workspace.creatorName.split(" ")[0] || "the creator";
    const topics = workspace.profile.topics.slice(0, 4).join(", ").toLowerCase();
    return `That is not really ${firstName}'s lane. I can help with ${topics}, or anything that connects back to their approved public work.`;
  }
  if (intent === "greeting") {
    const firstName = workspace.creatorName.split(" ")[0] || "there";
    return `Hey, appreciate you. What do you want to talk about with ${firstName} today?`;
  }
  if (intent === "vague") {
    return "I’m not fully sure what you mean. Ask me like you would in a DM, and I’ll take it from there.";
  }
  return "I’m having trouble pulling the creator-approved answer right now. Try again in a moment.";
}
