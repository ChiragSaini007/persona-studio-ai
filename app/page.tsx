"use client";

import { FormEvent, useMemo, useState } from "react";

type Tab = "signup" | "studio" | "chat" | "dashboard";
type PersonaStatus = "draft" | "live" | "paused";
type MonetizationMode = "free" | "pay_per_conversation";

type PersonaProfile = {
  topics: string[];
  phrases: string[];
  tone: string[];
};

type Guardrail = {
  key: string;
  title: string;
  description: string;
  keywords: string[];
  locked?: boolean;
};

type Message = {
  id: string;
  from: "fan" | "persona";
  text: string;
  flagged?: boolean;
  flagReason?: string;
  fallback?: boolean;
};

type Conversation = {
  id: string;
  fanName: string;
  paid: boolean;
  messages: Message[];
};

const sampleContent = `I have been thinking a lot about how creators build durable communities, not just audiences. The best creator businesses feel like operating systems: content, trust, commerce, data, and rewards all working together.

Real talk, AI should not replace the creator's judgment. It should extend their ability to respond, teach, entertain, and listen while keeping control close to the person whose reputation is on the line.

When people ask me about product strategy, I usually come back to the same questions: who feels the pain, who pays, why now, and what keeps this defensible if it works?

The creator economy is moving from campaign thinking to infrastructure thinking. Discovery, onboarding, attribution, payouts, loyalty, and analytics are becoming the real product surface.

My honest view: a product is only as good as the business system around it. Distribution, retention, willingness to pay, and operational trust matter as much as the feature set.`;

const guardrails: Guardrail[] = [
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

const fallbackText =
  "I cannot speak to that one. It is outside the boundaries this AI persona is approved to discuss, so please check the creator's official channels for their real view.";

const uid = () => Math.random().toString(36).slice(2, 10);

function makePersonaProfile(content: string): PersonaProfile {
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

function countFanMessages(conversations: Conversation[]) {
  return conversations.reduce(
    (count, conversation) => count + conversation.messages.filter((message) => message.from === "fan").length,
    0,
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("signup");
  const [creatorName, setCreatorName] = useState("Chirag Saini");
  const [creatorHandle, setCreatorHandle] = useState("@chirag");
  const [content, setContent] = useState(sampleContent);
  const [profile, setProfile] = useState<PersonaProfile>(() => makePersonaProfile(sampleContent));
  const [enabledGuardrails, setEnabledGuardrails] = useState(() =>
    Object.fromEntries(guardrails.map((rail) => [rail.key, true])),
  );
  const [customBoundary, setCustomBoundary] = useState("competitor claims");
  const [monetization, setMonetization] = useState<MonetizationMode>("free");
  const [price, setPrice] = useState(3);
  const [status, setStatus] = useState<PersonaStatus>("draft");
  const [conversationStarted, setConversationStarted] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [fanInput, setFanInput] = useState("");
  const [returningFans, setReturningFans] = useState(1);
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: uid(),
      fanName: "Pilot fan",
      paid: false,
      messages: [
        {
          id: uid(),
          from: "fan",
          text: "How should I think about building a creator product?",
        },
        {
          id: uid(),
          from: "persona",
          text: "Real talk, start with the creator's operating reality. If it does not improve trust, monetization, or repeat engagement, it is probably a feature pretending to be a business.",
        },
      ],
    },
  ]);

  const activeConversation = conversations[conversations.length - 1];

  const analytics = useMemo(() => {
    const fanMessages = conversations.flatMap((conversation) =>
      conversation.messages.filter((message) => message.from === "fan"),
    );
    const flagged = conversations.flatMap((conversation) => conversation.messages.filter((message) => message.flagged));
    const topicCounts = profile.topics.map((topic) => ({
      topic,
      count: fanMessages.filter((message) => message.text.toLowerCase().includes(topic.toLowerCase().split(" ")[0]))
        .length,
    }));
    const revenue = conversations.filter((conversation) => conversation.paid).length * price;

    return {
      conversationCount: conversations.length,
      messageCount: countFanMessages(conversations),
      flagged,
      fallbackRate: fanMessages.length ? Math.round((flagged.length / fanMessages.length) * 100) : 0,
      returnRate: conversations.length ? Math.round((returningFans / Math.max(conversations.length, 1)) * 100) : 0,
      topicCounts,
      revenue,
    };
  }, [conversations, price, profile.topics, returningFans]);

  function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveTab("studio");
  }

  function generateProfile() {
    setProfile(makePersonaProfile(content));
  }

  function publishPersona() {
    setStatus("live");
    setActiveTab("chat");
  }

  function startConversation(paid = false) {
    setConversationStarted(true);
    setPaywallOpen(false);
    setConversations((current) => [
      ...current,
      {
        id: uid(),
        fanName: "Fan visitor",
        paid,
        messages: [],
      },
    ]);
  }

  function findFlag(text: string) {
    const lower = text.toLowerCase();
    const matched = guardrails.find(
      (rail) => enabledGuardrails[rail.key] && rail.keywords.some((keyword) => lower.includes(keyword)),
    );

    if (matched) return matched.title;
    if (customBoundary && lower.includes(customBoundary.toLowerCase())) return customBoundary;
    if (lower.includes("real creator") || lower.includes("secret")) return "Creator-approved boundary";
    return "";
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = fanInput.trim();
    if (!text) return;

    const flagReason = findFlag(text);
    const topic = profile.topics.find((item) => text.toLowerCase().includes(item.toLowerCase().split(" ")[0]));
    const personaReply = flagReason
      ? fallbackText
      : `${profile.phrases[0]}, ${topic ? topic.toLowerCase() : "that"} connects back to trust and repeat engagement. The practical lens is: what would make the fan feel closer without putting words in the creator's mouth?`;

    setConversations((current) =>
      current.map((conversation, index) =>
        index === current.length - 1
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                { id: uid(), from: "fan", text },
                {
                  id: uid(),
                  from: "persona",
                  text: personaReply,
                  flagged: Boolean(flagReason),
                  fallback: Boolean(flagReason),
                  flagReason: flagReason || undefined,
                },
              ],
            }
          : conversation,
      ),
    );
    setFanInput("");
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#171819]">
      <section className="border-b border-[#d9d4c8] bg-[#fffdf8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b684f]">Persona Studio AI</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#171819]">Creator-controlled AI fan chat</h1>
          </div>
          <nav className="grid grid-cols-2 gap-2 sm:flex" aria-label="Persona Studio sections">
            {(["signup", "studio", "chat", "dashboard"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`h-10 rounded-md border px-4 text-sm font-semibold capitalize transition ${
                  activeTab === tab
                    ? "border-[#171819] bg-[#171819] text-white"
                    : "border-[#d9d4c8] bg-white text-[#504d47] hover:border-[#8f887b]"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-[#d9d4c8] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#504d47]">Persona status</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  status === "live"
                    ? "bg-[#d9f6df] text-[#146c2e]"
                    : status === "paused"
                      ? "bg-[#ffe2df] text-[#9f271f]"
                      : "bg-[#eee9df] text-[#6d6254]"
                }`}
              >
                {status}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#5f5b53]">
              <p>{creatorName || "Creator"} can sign up directly and publish after reviewing the AI profile.</p>
              <p>Payment is optional. Guardrails stay active for free and paid chats.</p>
            </div>
          </div>

          <div className="rounded-lg border border-[#d9d4c8] bg-[#25231f] p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f1c876]">Architecture-ready V0</p>
            <ul className="mt-3 space-y-2 text-sm text-[#eee8dc]">
              <li>Next.js creator and fan surfaces</li>
              <li>Supabase-ready content and analytics model</li>
              <li>OpenAI retrieval and moderation path</li>
              <li>Stripe-ready optional paywall</li>
            </ul>
          </div>
        </aside>

        <div className="min-w-0">
          {activeTab === "signup" && (
            <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <form onSubmit={signUp} className="rounded-lg border border-[#d9d4c8] bg-white p-5">
                <p className="text-sm font-semibold text-[#7b684f]">Creator signup</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">Create your AI persona workspace</h2>
                <p className="mt-3 max-w-2xl text-[#5f5b53]">
                  V0 allows creators and celebs to sign up directly, upload their own content, approve the persona, and
                  decide whether fan access is free or paid.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-[#504d47]">
                    Creator name
                    <input
                      value={creatorName}
                      onChange={(event) => setCreatorName(event.target.value)}
                      className="mt-2 h-11 w-full rounded-md border border-[#cfc8ba] px-3 outline-none focus:border-[#171819]"
                    />
                  </label>
                  <label className="text-sm font-semibold text-[#504d47]">
                    Public handle
                    <input
                      value={creatorHandle}
                      onChange={(event) => setCreatorHandle(event.target.value)}
                      className="mt-2 h-11 w-full rounded-md border border-[#cfc8ba] px-3 outline-none focus:border-[#171819]"
                    />
                  </label>
                </div>
                <label className="mt-5 flex items-start gap-3 rounded-md border border-[#d9d4c8] bg-[#fbfaf6] p-4 text-sm text-[#504d47]">
                  <input type="checkbox" defaultChecked className="mt-1" />
                  I confirm I own or have permission to use the uploaded content and understand fans will see a clear AI
                  disclosure.
                </label>
                <button className="mt-6 h-11 rounded-md bg-[#171819] px-5 text-sm font-bold text-white">
                  Continue to studio
                </button>
              </form>

              <div className="rounded-lg border border-[#d9d4c8] bg-[#fffdf8] p-5">
                <h3 className="text-lg font-semibold">V0 signup posture</h3>
                <div className="mt-4 space-y-3 text-sm text-[#5f5b53]">
                  <p>Open signup keeps onboarding lightweight.</p>
                  <p>Consent and content ownership are still explicit because the product speaks through a real identity.</p>
                  <p>Stronger verification can be added later for high-risk public figures.</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === "studio" && (
            <section className="space-y-5">
              <div className="rounded-lg border border-[#d9d4c8] bg-white p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#7b684f]">Creator Studio</p>
                    <h2 className="mt-1 text-3xl font-semibold tracking-tight">Train, review, and publish</h2>
                    <p className="mt-2 max-w-2xl text-[#5f5b53]">
                      Upload or paste creator-provided content. The profile below is generated for review before the
                      persona can go live.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatus(status === "paused" ? "live" : "paused")}
                      className="h-10 rounded-md border border-[#cfc8ba] px-4 text-sm font-bold text-[#504d47]"
                    >
                      {status === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button onClick={publishPersona} className="h-10 rounded-md bg-[#171819] px-4 text-sm font-bold text-white">
                      Publish
                    </button>
                  </div>
                </div>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="mt-5 min-h-48 w-full rounded-md border border-[#cfc8ba] bg-[#fbfaf6] p-4 text-sm leading-6 outline-none focus:border-[#171819]"
                />
                <button
                  onClick={generateProfile}
                  className="mt-4 h-10 rounded-md border border-[#171819] px-4 text-sm font-bold text-[#171819]"
                >
                  Generate persona profile
                </button>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                {[
                  ["Topics", profile.topics, "topic"],
                  ["Tone", profile.tone, "tone"],
                  ["Recurring phrases", profile.phrases, "phrase"],
                ].map(([title, items, key]) => (
                  <div key={String(title)} className="rounded-lg border border-[#d9d4c8] bg-white p-5">
                    <h3 className="font-semibold">{String(title)}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(items as string[]).map((item) => (
                        <span key={item} className={`rounded-full px-3 py-1 text-xs font-bold ${key}`}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-[#d9d4c8] bg-white p-5">
                <h3 className="text-lg font-semibold">Guardrails and fallback</h3>
                <p className="mt-2 text-sm text-[#5f5b53]">
                  Flagged means a chat touched a safety rule, blocked topic, identity boundary, or fallback path. It is
                  logged for creator visibility.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {guardrails.map((rail) => (
                    <label key={rail.key} className="rounded-md border border-[#d9d4c8] bg-[#fbfaf6] p-4">
                      <span className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={enabledGuardrails[rail.key]}
                          disabled={rail.locked}
                          onChange={() =>
                            setEnabledGuardrails((current) => ({ ...current, [rail.key]: !current[rail.key] }))
                          }
                          className="mt-1"
                        />
                        <span>
                          <span className="font-semibold">{rail.title}</span>
                          {rail.locked && <span className="ml-2 text-xs font-bold text-[#9f271f]">Always on</span>}
                          <span className="mt-1 block text-sm text-[#5f5b53]">{rail.description}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="text-sm font-semibold text-[#504d47]">
                    Custom off-limits topic
                    <input
                      value={customBoundary}
                      onChange={(event) => setCustomBoundary(event.target.value)}
                      className="mt-2 h-11 w-full rounded-md border border-[#cfc8ba] px-3 outline-none focus:border-[#171819]"
                    />
                  </label>
                  <div className="rounded-md border border-[#d9d4c8] bg-[#fbfaf6] p-4 text-sm text-[#504d47]">
                    <span className="font-semibold">Fixed fallback</span>
                    <p className="mt-2">{fallbackText}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "chat" && (
            <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="overflow-hidden rounded-lg border border-[#d9d4c8] bg-white">
                <div className="border-b border-[#d9d4c8] bg-[#fff7df] p-4 text-sm text-[#5f4a1a]">
                  You are chatting with an AI persona trained on {creatorName}&apos;s provided content. This is not the
                  real creator, and risky or off-topic questions receive a fixed fallback.
                </div>
                <div className="flex h-[520px] flex-col">
                  <div className="flex-1 space-y-3 overflow-y-auto p-5">
                    {!conversationStarted && (
                      <div className="rounded-md border border-[#d9d4c8] bg-[#fbfaf6] p-5 text-center">
                        <h2 className="text-2xl font-semibold">Chat with {creatorName}&apos;s AI persona</h2>
                        <p className="mt-2 text-sm text-[#5f5b53]">Access can be free or paid, based on creator settings.</p>
                        <button
                          onClick={() => (monetization === "free" ? startConversation(false) : setPaywallOpen(true))}
                          disabled={status === "paused"}
                          className="mt-5 h-11 rounded-md bg-[#171819] px-5 text-sm font-bold text-white disabled:opacity-40"
                        >
                          Start conversation
                        </button>
                      </div>
                    )}
                    {conversationStarted &&
                      activeConversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`max-w-[82%] rounded-lg p-3 text-sm leading-6 ${
                            message.from === "fan"
                              ? "ml-auto bg-[#171819] text-white"
                              : message.flagged
                                ? "border border-[#efb6af] bg-[#fff1ef] text-[#5d211c]"
                                : "bg-[#eee9df] text-[#25231f]"
                          }`}
                        >
                          {message.text}
                          {message.flagged && (
                            <div className="mt-2 text-xs font-bold uppercase tracking-[0.12em]">
                              Flagged: {message.flagReason}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                  <form onSubmit={sendMessage} className="flex gap-2 border-t border-[#d9d4c8] p-4">
                    <input
                      value={fanInput}
                      onChange={(event) => setFanInput(event.target.value)}
                      disabled={!conversationStarted || status === "paused"}
                      placeholder="Ask about creator economy, AI products, or product strategy..."
                      className="h-11 min-w-0 flex-1 rounded-md border border-[#cfc8ba] px-3 text-sm outline-none focus:border-[#171819] disabled:bg-[#eee9df]"
                    />
                    <button className="h-11 rounded-md bg-[#171819] px-5 text-sm font-bold text-white">Send</button>
                  </form>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-lg border border-[#d9d4c8] bg-white p-5">
                  <h3 className="font-semibold">Fan access</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMonetization("free")}
                      className={`h-10 rounded-md border text-sm font-bold ${
                        monetization === "free" ? "border-[#171819] bg-[#171819] text-white" : "border-[#cfc8ba]"
                      }`}
                    >
                      Free
                    </button>
                    <button
                      onClick={() => setMonetization("pay_per_conversation")}
                      className={`h-10 rounded-md border text-sm font-bold ${
                        monetization === "pay_per_conversation"
                          ? "border-[#171819] bg-[#171819] text-white"
                          : "border-[#cfc8ba]"
                      }`}
                    >
                      Paid
                    </button>
                  </div>
                  <label className="mt-4 block text-sm font-semibold text-[#504d47]">
                    Price per conversation
                    <input
                      type="number"
                      value={price}
                      min={1}
                      onChange={(event) => setPrice(Number(event.target.value))}
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc8ba] px-3"
                    />
                  </label>
                </div>

                {paywallOpen && (
                  <div className="rounded-lg border border-[#171819] bg-[#fffdf8] p-5">
                    <h3 className="text-lg font-semibold">Unlock conversation</h3>
                    <p className="mt-2 text-sm text-[#5f5b53]">Mock Stripe checkout for V0 validation.</p>
                    <p className="mt-4 text-3xl font-bold">${price.toFixed(2)}</p>
                    <button
                      onClick={() => startConversation(true)}
                      className="mt-4 h-10 w-full rounded-md bg-[#171819] text-sm font-bold text-white"
                    >
                      Pay and unlock
                    </button>
                  </div>
                )}
              </aside>
            </section>
          )}

          {activeTab === "dashboard" && (
            <section className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Conversations", analytics.conversationCount],
                  ["Fan messages", analytics.messageCount],
                  ["Fallback rate", `${analytics.fallbackRate}%`],
                  ["Revenue", `$${analytics.revenue.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-[#d9d4c8] bg-white p-5">
                    <p className="text-sm font-semibold text-[#7b684f]">{String(label)}</p>
                    <p className="mt-2 text-3xl font-bold">{String(value)}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-lg border border-[#d9d4c8] bg-white p-5">
                  <h3 className="text-lg font-semibold">Common fan topics</h3>
                  <div className="mt-4 space-y-3">
                    {analytics.topicCounts.map(({ topic, count }) => (
                      <div key={topic} className="flex items-center justify-between border-b border-[#eee9df] pb-3">
                        <span className="text-sm font-semibold">{topic}</span>
                        <span className="text-sm text-[#5f5b53]">{count} mentions</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[#d9d4c8] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Flagged interactions</h3>
                      <p className="mt-1 text-sm text-[#5f5b53]">
                        Flagged means the system hit a safety rule, off-limits topic, or fixed fallback.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#fff1ef] px-3 py-1 text-xs font-bold text-[#9f271f]">
                      {analytics.flagged.length}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {analytics.flagged.length === 0 && (
                      <p className="rounded-md bg-[#fbfaf6] p-4 text-sm text-[#5f5b53]">No flagged interactions yet.</p>
                    )}
                    {analytics.flagged.map((message) => (
                      <div key={message.id} className="rounded-md border border-[#efb6af] bg-[#fff8f7] p-4">
                        <p className="text-sm font-semibold text-[#9f271f]">{message.flagReason}</p>
                        <p className="mt-2 text-sm text-[#5f5b53]">{message.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#d9d4c8] bg-[#25231f] p-5 text-white">
                <h3 className="text-lg font-semibold">Pilot health</h3>
                <p className="mt-2 text-sm text-[#eee8dc]">
                  Fan return rate is currently {analytics.returnRate}%. For V0, the question is simple: do fans return
                  even when the AI is clearly disclosed and conservative?
                </p>
                <button
                  onClick={() => setReturningFans((count) => count + 1)}
                  className="mt-4 h-10 rounded-md bg-white px-4 text-sm font-bold text-[#171819]"
                >
                  Simulate returning fan
                </button>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
