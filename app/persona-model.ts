"use client";

import { useEffect, useMemo, useState } from "react";

export type PersonaStatus = "draft" | "live" | "paused";
export type MonetizationMode = "free" | "pay_per_conversation";

export type PersonaProfile = {
  topics: string[];
  phrases: string[];
  tone: string[];
};

export type Message = {
  id: string;
  from: "fan" | "persona";
  text: string;
  flagged?: boolean;
  flagReason?: string;
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
    keywords: ["girlfriend", "boyfriend", "address", "family drama", "rumor"],
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
  };
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
      setWorkspace({ ...defaultWorkspace(), ...JSON.parse(saved) });
    }
    setLoaded(true);
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
  if (workspace.customBoundary && lower.includes(workspace.customBoundary.toLowerCase())) return workspace.customBoundary;
  if (lower.includes("real creator") || lower.includes("secret")) return "Creator-approved boundary";
  return "";
}

export function generatePersonaReply(workspace: PersonaWorkspace, text: string, flagReason: string) {
  if (flagReason) return workspace.fallbackText;
  const topic = workspace.profile.topics.find((item) => text.toLowerCase().includes(item.toLowerCase().split(" ")[0]));
  return `${workspace.profile.phrases[0]}, ${topic ? topic.toLowerCase() : "that"} connects back to trust and repeat engagement. The practical lens is: what would make the fan feel closer without putting words in the creator's mouth?`;
}
