"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { clearStoredSession, getStoredSession, refreshStoredSession, supabasePasswordAuth } from "../../auth-client";
import {
  cleanHandle,
  findFlag,
  generatePersonaReply,
  Message,
  normalizePersonaProfile,
  uid,
  usePersonaWorkspace,
} from "../../persona-model";

type RemotePersona = ReturnType<typeof usePersonaWorkspace>["workspace"];
type FanConversation = {
  id: string;
  paid: boolean;
  created_at?: string;
  messages: Message[];
};

function renderMessageText(text: string) {
  const renderLinkedText = (value: string, keyPrefix: string) => {
    const parts: ReactNode[] = [];
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(value))) {
      if (match.index > lastIndex) parts.push(value.slice(lastIndex, match.index));

      const label = match[1] || match[3];
      const url = match[2] || match[3];
      parts.push(
        <a key={`${keyPrefix}-${url}-${match.index}`} href={url} target="_blank" rel="noreferrer">
          {label}
        </a>,
      );
      lastIndex = linkPattern.lastIndex;
    }

    if (lastIndex < value.length) parts.push(value.slice(lastIndex));
    return parts.length ? parts : value;
  };

  const lines = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return lines.map((line, index) => {
      const listMatch = line.match(/^(\d+)\.\s+(.*)$/);
      return (
        <p key={`${line}-${index}`} className={listMatch ? "message-line numbered" : "message-line"}>
          {listMatch && <span>{listMatch[1]}</span>}
          <span>{renderLinkedText(listMatch ? listMatch[2] : line, `line-${index}`)}</span>
        </p>
      );
    });
  }

  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    const label = match[1] || match[3];
    const url = match[2] || match[3];
    parts.push(
      <a key={`${url}-${match.index}`} href={url} target="_blank" rel="noreferrer">
        {label}
      </a>,
    );
    lastIndex = linkPattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}

export default function FanChatPage() {
  const { workspace, setWorkspace } = usePersonaWorkspace();
  const params = useParams<{ handle: string }>();
  const searchParams = useSearchParams();
  const handle = cleanHandle(params?.handle || workspace.creatorHandle);
  const [remotePersona, setRemotePersona] = useState<RemotePersona | null>(null);
  const [started, setStarted] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [remoteMessages, setRemoteMessages] = useState<Message[]>([]);
  const [fanHistory, setFanHistory] = useState<FanConversation[]>([]);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [fanEmail, setFanEmail] = useState("");
  const [fanPassword, setFanPassword] = useState("");
  const [fanAccessToken, setFanAccessToken] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const activeConversation = workspace.conversations[workspace.conversations.length - 1];
  const activePersona = remotePersona || workspace;
  const paidFromStripe = useMemo(() => searchParams.get("paid") === "1", [searchParams]);
  const creatorName = activePersona.creatorName?.trim() || "the creator";
  const creatorFirstName = creatorName === "the creator" ? "the creator" : creatorName.split(" ")[0] || "the creator";
  const thinkingPhrases = [
    `${creatorFirstName} is thinking...`,
    `Reading ${creatorFirstName}'s approved context...`,
    `Shaping the reply in ${creatorFirstName}'s style...`,
  ];
  const welcomeTopics = activePersona.profile.topics.slice(0, 3).join(", ").toLowerCase();
  const welcomeMessage = activePersona.profile.greetingStyle?.trim()
    || `Hey, good to see you here. Ask me anything${welcomeTopics ? ` around ${welcomeTopics}` : ""}, or send me what you are thinking about.`;
  const suggestedPrompts = useMemo(() => {
    const topic = activePersona.profile.topics[0]?.toLowerCase() || "this";
    return [
      `Explain ${topic} simply`,
      "Give me an example",
      "Explain with numbers",
      "What should I do next?",
    ];
  }, [activePersona.profile.topics]);

  const loadFanHistory = useCallback(async (token = fanAccessToken) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/chat/history?handle=${encodeURIComponent(handle)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load chat history");
      setFanHistory(data.conversations || []);
    } catch {
      setFanHistory([]);
    }
  }, [fanAccessToken, handle]);

  const restoreFanSession = useCallback(async () => {
    const session = getStoredSession();
    if (!session?.access_token) return;

    setFanAccessToken(session.access_token || "");
    setFanEmail(session.user?.email || "");
    await loadFanHistory(session.access_token);
  }, [loadFanHistory]);

  useEffect(() => {
    if (!isSending) return;

    const interval = window.setInterval(() => {
      setThinkingStep((current) => (current + 1) % thinkingPhrases.length);
    }, 1400);

    return () => window.clearInterval(interval);
  }, [isSending, thinkingPhrases.length]);

  useEffect(() => {
    queueMicrotask(() => void restoreFanSession());

    async function loadPersona() {
      try {
        const response = await fetch(`/api/personas?handle=${encodeURIComponent(handle)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Using local preview persona");
        const persona = data.persona;
        setRemotePersona({
          ...workspace,
          creatorName: persona.creator_name,
          creatorHandle: `@${persona.creator_handle}`,
          content: persona.source_content,
          profile: normalizePersonaProfile(persona.profile, persona.source_content),
          enabledGuardrails: persona.enabled_guardrails,
          customBoundary: persona.custom_boundary,
          fallbackText: persona.fallback_text,
          monetization: persona.monetization,
          price: persona.price_cents / 100,
          status: persona.status,
        });
        setNotice("");
      } catch (error) {
        setRemotePersona(null);
        setNotice(error instanceof Error ? error.message : "Using local preview persona");
      }
    }

    void loadPersona();
  }, [handle, restoreFanSession, workspace]);

  function resumeConversation(conversation: FanConversation) {
    setConversationId(conversation.id);
    setRemoteMessages(conversation.messages || []);
    setStarted(true);
    setPaywall(false);
    setNotice("");
  }

  async function authenticateFan() {
    setNotice(authMode === "signup" ? "Creating fan account..." : "Signing in...");
    try {
      const session = await supabasePasswordAuth(authMode, fanEmail, fanPassword);
      setFanAccessToken(session.access_token);
      await loadFanHistory(session.access_token);
      setNotice(authMode === "signup" ? "Fan account created. You can start chatting." : "Signed in. You can start chatting.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  function signOutFan() {
    clearStoredSession();
    setFanAccessToken("");
    setNotice("Signed out.");
  }

  async function startConversation(paid = false) {
    const isPaid = paid || paidFromStripe;
    let token = fanAccessToken || getStoredSession()?.access_token || "";
    if (!token) {
      setFanAccessToken("");
      setNotice("Please sign up or sign in before starting the chat.");
      return;
    }
    setFanAccessToken(token);

    if (remotePersona) {
      try {
        const startRemoteChat = (accessToken: string) => fetch("/api/chat/start", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            handle,
            paid: isPaid,
            stripe_session_id: searchParams.get("session_id"),
          }),
        });
        let response = await startRemoteChat(token);
        let data = await response.json();
        if (response.status === 401) {
          const refreshed = await refreshStoredSession();
          token = refreshed?.access_token || "";
          if (token) {
            setFanAccessToken(token);
            setFanEmail(refreshed?.user?.email || fanEmail);
            response = await startRemoteChat(token);
            data = await response.json();
          }
        }
        if (response.status === 402) {
          setPaywall(true);
          return;
        }
        if (response.status === 401) {
          clearStoredSession();
          setFanAccessToken("");
          setStarted(false);
          setNotice("Please sign in again to start chatting.");
          return;
        }
        if (!response.ok) throw new Error(data.error || "Unable to start chat");
        setConversationId(data.conversation.id);
        setRemoteMessages([{ id: uid(), from: "persona", text: welcomeMessage }]);
        await loadFanHistory(token);
        setStarted(true);
        setPaywall(false);
        return;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Using local chat fallback");
      }
    }

    setStarted(true);
    setPaywall(false);
    setWorkspace((current) => ({
      ...current,
      conversations: [...current.conversations, { id: uid(), paid: isPaid, messages: [{ id: uid(), from: "persona", text: welcomeMessage }] }],
    }));
  }

  async function sendFanMessage(text: string) {
    if (!text) return;

    if (remotePersona && conversationId) {
      setInput("");
      setThinkingStep(0);
      setIsSending(true);
      setRemoteMessages((current) => [...current, { id: uid(), from: "fan", text }]);

      try {
        const response = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message: text }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to send message");
        setRemoteMessages((current) => [
          ...current,
          {
            id: uid(),
            from: "persona",
            text: data.reply,
            flagged: Boolean(data.flagReason),
            flagReason: data.flagReason,
            usedWeb: Boolean(data.usedWeb),
            sourceCount: Number(data.webSourceCount || 0),
          },
        ]);
        void loadFanHistory();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Message failed");
      } finally {
        setIsSending(false);
      }
      return;
    }

    const flagReason = findFlag(workspace, text);
    const reply = generatePersonaReply(workspace, text, flagReason);
    setWorkspace((current) => ({
      ...current,
      conversations: current.conversations.map((conversation, index) =>
        index === current.conversations.length - 1
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                { id: uid(), from: "fan", text },
                { id: uid(), from: "persona", text: reply, flagged: Boolean(flagReason), flagReason: flagReason || undefined },
              ],
            }
          : conversation,
      ),
    }));
    setInput("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendFanMessage(input.trim());
  }

  async function askSuggested(prompt: string) {
    if (!started || isSending) {
      setInput(prompt);
      return;
    }
    await sendFanMessage(prompt);
  }

  async function openCheckout() {
    if (!remotePersona) {
      setPaywall(true);
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to open checkout");
      window.location.assign(data.url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Stripe is not configured");
      setPaywall(true);
    }
  }

  if (activePersona.status !== "live") {
    return (
      <main className="app-shell">
        <section className="stage fan-stage">
          <nav className="top-nav">
            <Link className="brand-script" href="/">
              Persona Studio
            </Link>
            <div className="nav-tabs">
              <Link href="/creator">Creator portal</Link>
            </div>
            <span className={`status-chip ${activePersona.status}`}>Not live</span>
          </nav>
          <div className="empty-public">
            <h1>This persona is not live yet</h1>
            <p>The creator needs to publish from the creator portal before fans can chat here.</p>
            <Link className="primary-btn" href="/creator">
              Open creator portal
            </Link>
            {notice && <p className="runtime-note">{notice}</p>}
          </div>
        </section>
      </main>
    );
  }

  const visibleMessages = remotePersona ? remoteMessages : activeConversation.messages;

  return (
    <main className="app-shell fan-shell">
      <section className="stage fan-stage">
        <nav className="top-nav">
          <Link className="brand-script" href="/">
            Persona Studio
          </Link>
          <div className="nav-tabs">
            <Link href="/creator">Creator portal</Link>
          </div>
          <span className="status-chip live">AI persona</span>
        </nav>

        <header className="fan-hero dm-hero">
          <div className="fan-title-block">
            <div className="fan-avatar">{creatorName.slice(0, 2).toUpperCase()}</div>
            <p className="section-kicker">Public fan chat</p>
            <h1>
              Talk to <span>{creatorName}</span>
            </h1>
            <p>
              Ask what you would normally DM {creatorFirstName}. The AI answers in their approved public voice and uses current sources only when the question needs them.
            </p>
          </div>
        </header>

        <section className="chat-layout public-chat-layout">
          <div className="chat-window">
            <div className="dm-thread-header">
              <div className="dm-avatar">{creatorName.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{creatorName}&apos;s AI</strong>
                <span>Approved context, disclosed AI, reviewable safety rails</span>
              </div>
              <em>{activePersona.status === "live" ? "Live" : "Preview"}</em>
            </div>
            <div className="disclosure">
              This is {creatorName}&apos;s AI persona. It uses approved creator material, remembers this conversation, and steps back from private or risky requests.
            </div>
            <div className="chat-body">
              <div className="messages">
                {!started && (
                  <div className="empty-chat">
                    <h2>{activePersona.monetization === "free" ? `Start a DM with ${creatorFirstName}` : "Unlock this chat"}</h2>
                    <p>
                      {activePersona.monetization === "free"
                        ? "Sign in once. Your chat history stays with you."
                        : `This creator charges $${activePersona.price.toFixed(2)} per conversation.`}
                    </p>
                    {!fanAccessToken && (
                      <div className="fan-auth-box">
                        <div className="auth-switch">
                          <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
                            Sign up
                          </button>
                          <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>
                            Sign in
                          </button>
                        </div>
                        <input value={fanEmail} type="email" placeholder="Email" onChange={(event) => setFanEmail(event.target.value)} />
                        <input
                          value={fanPassword}
                          type="password"
                          placeholder="Password"
                          onChange={(event) => setFanPassword(event.target.value)}
                        />
                        <button onClick={authenticateFan} className="secondary-action">
                          {authMode === "signup" ? "Create fan account" : "Sign in"}
                        </button>
                      </div>
                    )}
                    {fanAccessToken && (
                      <div className="connected-account fan-connected">
                        <strong>{fanEmail || "Fan account connected"}</strong>
                        <button className="secondary-action" onClick={signOutFan}>
                          Sign out
                        </button>
                      </div>
                    )}
                    {notice && <p className="inline-chat-notice">{notice}</p>}
                    <button
                      onClick={() =>
                        activePersona.monetization === "free" || paidFromStripe
                          ? void startConversation(paidFromStripe)
                          : void openCheckout()
                      }
                      className="primary-btn"
                      disabled={!fanAccessToken}
                    >
                      {activePersona.monetization === "free" || paidFromStripe ? "Start conversation" : "Continue to paywall"}
                    </button>
                  </div>
                )}

                {started &&
                  visibleMessages.map((message) => (
                    <div key={message.id} className={`message ${message.from === "fan" ? "fan" : ""} ${message.flagged ? "flagged" : ""}`}>
                      {renderMessageText(message.text)}
                      {message.from === "persona" && (
                        <div className={`source-strip ${message.usedWeb ? "web" : "creator"}`}>
                          {message.usedWeb
                            ? `Creator context + current public sources${message.sourceCount ? ` · ${message.sourceCount} lookup${message.sourceCount === 1 ? "" : "s"}` : ""}`
                            : "Creator-approved context"}
                        </div>
                      )}
                      {message.flagged && <div className="flag-label">Flagged: {message.flagReason}</div>}
                    </div>
                  ))}
                {started && isSending && (
                  <div className="message thinking" aria-live="polite">
                    <span>{thinkingPhrases[thinkingStep]}</span>
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>
              {started && (
                <div className="suggested-prompts">
                  {suggestedPrompts.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => void askSuggested(prompt)} disabled={isSending}>
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={submit} className="chat-form">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={!started || isSending}
                  placeholder={`Message ${creatorFirstName}'s AI...`}
                />
                <button className="primary-btn compact" disabled={!started || isSending}>
                  {isSending ? "Sending" : "Send"}
                </button>
              </form>
            </div>
          </div>

          <aside className="side-stack">
            {paywall && (
              <div className="purple-card">
                <h3>Paywall</h3>
                <p>{remotePersona ? "Stripe is not configured yet." : "Mock checkout for local preview."}</p>
                <strong className="price">${activePersona.price.toFixed(2)}</strong>
                <button className="primary-btn" onClick={() => void startConversation(true)}>
                  Pay and start chat
                </button>
              </div>
            )}
            <div className="dark-card">
              <span className="tiny-label">Good to know</span>
              <p>
                Keep it close to {creatorFirstName}&apos;s public work. If the answer needs current facts and fits the topic, the persona can use public sources.
              </p>
              {notice && <p className="runtime-note">{notice}</p>}
            </div>
            {fanAccessToken && (
              <div className="history-card">
                <span className="tiny-label">Your chats</span>
                <div className="history-list">
                  {fanHistory.slice(0, 5).map((conversation) => {
                    const firstFanMessage = conversation.messages.find((message) => message.from === "fan")?.text || "New conversation";
                    return (
                      <button
                        key={conversation.id}
                        className={conversation.id === conversationId ? "active" : ""}
                        onClick={() => resumeConversation(conversation)}
                      >
                        <strong>{firstFanMessage}</strong>
                        <span>{conversation.messages.length} messages</span>
                      </button>
                    );
                  })}
                  {!fanHistory.length && <p>No previous chats yet.</p>}
                </div>
              </div>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}
