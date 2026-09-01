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
    <main className="app-shell">
      <div className="burst burst-top" />
      <div className="burst burst-left" />
      <section className="stage">
        <nav className="top-nav" aria-label="Persona Studio sections">
          <div className="brand-script">Persona</div>
          <div className="nav-tabs">
            {(["signup", "studio", "chat", "dashboard"] as Tab[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? "active" : ""}>
                {tab}
              </button>
            ))}
          </div>
          <div className={`status-chip ${status}`}>{status}</div>
        </nav>

        <header className="hero-row">
          <div className="hero-copy">
            <p className="eyebrow">Creator-controlled AI fan chat</p>
            <h1>
              Build your <span>AI persona</span>
            </h1>
            <p>
              Creators sign up, upload content, approve the persona, set guardrails, and share a fan chat link with an
              optional paywall.
            </p>
          </div>
          <div className="creator-poster" aria-label="Persona preview">
            <div className="poster-card">
              <div className="avatar-cutout">{creatorName.slice(0, 1) || "P"}</div>
              <div className="poster-label">{creatorHandle}</div>
            </div>
            <div className="scribble-arrow">↝</div>
          </div>
        </header>

        <section className="workspace-grid">
          <aside className="side-stack">
            <div className="pop-card mint-card">
              <span className="tiny-label">Status</span>
              <strong>{status === "live" ? "Persona live" : status === "paused" ? "Paused" : "Draft mode"}</strong>
              <p>{creatorName || "Creator"} can publish only after reviewing profile and boundaries.</p>
            </div>

            <div className="pop-card dark-card">
              <span className="tiny-label">Stack</span>
              <p>Next.js surface, Supabase-ready data, OpenAI runtime, Stripe optional payments.</p>
            </div>
          </aside>

          <div className="content-stack">
          {activeTab === "signup" && (
            <section className="two-col">
              <form onSubmit={signUp} className="pop-card main-card">
                <p className="tiny-label">Creator signup</p>
                <h2>Create your AI persona workspace</h2>
                <p>
                  V0 allows creators and celebs to sign up directly, upload their own content, approve the persona, and
                  decide whether fan access is free or paid.
                </p>
                <div className="field-grid">
                  <label>
                    Creator name
                    <input
                      value={creatorName}
                      onChange={(event) => setCreatorName(event.target.value)}
                    />
                  </label>
                  <label>
                    Public handle
                    <input
                      value={creatorHandle}
                      onChange={(event) => setCreatorHandle(event.target.value)}
                    />
                  </label>
                </div>
                <label className="check-row">
                  <input type="checkbox" defaultChecked />
                  I confirm I own or have permission to use the uploaded content and understand fans will see a clear AI
                  disclosure.
                </label>
                <button className="primary-btn">Continue to studio</button>
              </form>

              <div className="pop-card purple-card">
                <h3>Open signup</h3>
                <p>Lightweight onboarding with explicit content ownership and AI disclosure acceptance.</p>
                <div className="mini-badges">
                  <span>Consent</span>
                  <span>Content</span>
                  <span>Control</span>
                </div>
              </div>
            </section>
          )}

          {activeTab === "studio" && (
            <section className="screen-stack">
              <div className="pop-card main-card">
                <div className="split-head">
                  <div>
                    <p className="tiny-label">Creator Studio</p>
                    <h2>Train, review, and publish</h2>
                    <p>
                      Upload or paste creator-provided content. The profile below is generated for review before the
                      persona can go live.
                    </p>
                  </div>
                  <div className="button-row">
                    <button
                      onClick={() => setStatus(status === "paused" ? "live" : "paused")}
                      className="secondary-btn"
                    >
                      {status === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button onClick={publishPersona} className="primary-btn compact">Publish</button>
                  </div>
                </div>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
                <button onClick={generateProfile} className="secondary-btn">Generate persona profile</button>
              </div>

              <div className="profile-grid">
                {[
                  ["Topics", profile.topics, "topic"],
                  ["Tone", profile.tone, "tone"],
                  ["Recurring phrases", profile.phrases, "phrase"],
                ].map(([title, items, key]) => (
                  <div key={String(title)} className="pop-card small-card">
                    <h3>{String(title)}</h3>
                    <div className="chip-wrap">
                      {(items as string[]).map((item) => (
                        <span key={item} className={`pill ${key}`}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pop-card main-card">
                <h3>Guardrails and fallback</h3>
                <p>
                  Flagged means a chat touched a safety rule, blocked topic, identity boundary, or fallback path. It is
                  logged for creator visibility.
                </p>
                <div className="guardrail-grid">
                  {guardrails.map((rail) => (
                    <label key={rail.key} className="guardrail-card">
                      <span>
                        <input
                          type="checkbox"
                          checked={enabledGuardrails[rail.key]}
                          disabled={rail.locked}
                          onChange={() =>
                            setEnabledGuardrails((current) => ({ ...current, [rail.key]: !current[rail.key] }))
                          }
                        />
                        <span>
                          <strong>{rail.title}</strong>
                          {rail.locked && <em>Always on</em>}
                          <small>{rail.description}</small>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="field-grid">
                  <label>
                    Custom off-limits topic
                    <input
                      value={customBoundary}
                      onChange={(event) => setCustomBoundary(event.target.value)}
                    />
                  </label>
                  <div className="fallback-box">
                    <strong>Fixed fallback</strong>
                    <p>{fallbackText}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "chat" && (
            <section className="chat-layout">
              <div className="chat-window">
                <div className="disclosure">
                  You are chatting with an AI persona trained on {creatorName}&apos;s provided content. This is not the
                  real creator, and risky or off-topic questions receive a fixed fallback.
                </div>
                <div className="chat-body">
                  <div className="messages">
                    {!conversationStarted && (
                      <div className="empty-chat">
                        <h2>Chat with {creatorName}&apos;s AI persona</h2>
                        <p>Access can be free or paid, based on creator settings.</p>
                        <button
                          onClick={() => (monetization === "free" ? startConversation(false) : setPaywallOpen(true))}
                          disabled={status === "paused"}
                          className="primary-btn"
                        >
                          Start conversation
                        </button>
                      </div>
                    )}
                    {conversationStarted &&
                      activeConversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`message ${message.from === "fan" ? "fan" : ""} ${message.flagged ? "flagged" : ""}`}
                        >
                          {message.text}
                          {message.flagged && <div className="flag-label">Flagged: {message.flagReason}</div>}
                        </div>
                      ))}
                  </div>
                  <form onSubmit={sendMessage} className="chat-form">
                    <input
                      value={fanInput}
                      onChange={(event) => setFanInput(event.target.value)}
                      disabled={!conversationStarted || status === "paused"}
                      placeholder="Ask about creator economy, AI products, or product strategy..."
                    />
                    <button className="primary-btn compact">Send</button>
                  </form>
                </div>
              </div>

              <aside className="side-stack">
                <div className="pop-card mint-card">
                  <h3>Fan access</h3>
                  <div className="toggle-row">
                    <button
                      onClick={() => setMonetization("free")}
                      className={monetization === "free" ? "active" : ""}
                    >
                      Free
                    </button>
                    <button
                      onClick={() => setMonetization("pay_per_conversation")}
                      className={monetization === "pay_per_conversation" ? "active" : ""}
                    >
                      Paid
                    </button>
                  </div>
                  <label>
                    Price per conversation
                    <input
                      type="number"
                      value={price}
                      min={1}
                      onChange={(event) => setPrice(Number(event.target.value))}
                    />
                  </label>
                </div>

                {paywallOpen && (
                  <div className="pop-card purple-card">
                    <h3>Unlock conversation</h3>
                    <p>Mock Stripe checkout for V0 validation.</p>
                    <strong className="price">${price.toFixed(2)}</strong>
                    <button onClick={() => startConversation(true)} className="primary-btn">Pay and unlock</button>
                  </div>
                )}
              </aside>
            </section>
          )}

          {activeTab === "dashboard" && (
            <section className="screen-stack">
              <div className="metric-grid">
                {[
                  ["Conversations", analytics.conversationCount],
                  ["Fan messages", analytics.messageCount],
                  ["Fallback rate", `${analytics.fallbackRate}%`],
                  ["Revenue", `$${analytics.revenue.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="pop-card metric-card">
                    <p>{String(label)}</p>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>

              <div className="two-col">
                <div className="pop-card main-card">
                  <h3>Common fan topics</h3>
                  <div className="table-list">
                    {analytics.topicCounts.map(({ topic, count }) => (
                      <div key={topic}>
                        <strong>{topic}</strong>
                        <span>{count} mentions</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pop-card main-card">
                  <div className="split-head">
                    <div>
                      <h3>Flagged interactions</h3>
                      <p>
                        Flagged means the system hit a safety rule, off-limits topic, or fixed fallback.
                      </p>
                    </div>
                    <span className="count-badge">{analytics.flagged.length}</span>
                  </div>
                  <div className="flag-list">
                    {analytics.flagged.length === 0 && (
                      <p>No flagged interactions yet.</p>
                    )}
                    {analytics.flagged.map((message) => (
                      <div key={message.id}>
                        <strong>{message.flagReason}</strong>
                        <p>{message.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pop-card dark-card">
                <h3>Pilot health</h3>
                <p>
                  Fan return rate is currently {analytics.returnRate}%. For V0, the question is simple: do fans return
                  even when the AI is clearly disclosed and conservative?
                </p>
                <button onClick={() => setReturningFans((count) => count + 1)} className="light-btn">
                  Simulate returning fan
                </button>
              </div>
            </section>
          )}
        </div>
      </section>
      </section>
    </main>
  );
}
