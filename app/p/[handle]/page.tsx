"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { clearStoredSession, getStoredSession, supabasePasswordAuth } from "../../auth-client";
import { cleanHandle, findFlag, generatePersonaReply, Message, uid, usePersonaWorkspace } from "../../persona-model";

type RemotePersona = ReturnType<typeof usePersonaWorkspace>["workspace"];

export default function FanChatPage() {
  const { workspace, setWorkspace, analytics } = usePersonaWorkspace();
  const params = useParams<{ handle: string }>();
  const searchParams = useSearchParams();
  const handle = cleanHandle(params?.handle || workspace.creatorHandle);
  const [remotePersona, setRemotePersona] = useState<RemotePersona | null>(null);
  const [started, setStarted] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [remoteMessages, setRemoteMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [fanEmail, setFanEmail] = useState("");
  const [fanPassword, setFanPassword] = useState("");
  const [fanAccessToken, setFanAccessToken] = useState("");
  const activeConversation = workspace.conversations[workspace.conversations.length - 1];
  const activePersona = remotePersona || workspace;
  const fanPath = `/p/${handle}`;
  const paidFromStripe = useMemo(() => searchParams.get("paid") === "1", [searchParams]);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.access_token) {
      setFanAccessToken(session.access_token);
      setFanEmail(session.user?.email || "");
    }

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
          profile: persona.profile,
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
  }, [handle]);

  async function authenticateFan() {
    setNotice(authMode === "signup" ? "Creating fan account..." : "Signing in...");
    try {
      const session = await supabasePasswordAuth(authMode, fanEmail, fanPassword);
      setFanAccessToken(session.access_token);
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
    if (!fanAccessToken) {
      setNotice("Please sign up or sign in before starting the chat.");
      return;
    }

    if (remotePersona) {
      try {
        const response = await fetch("/api/chat/start", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${fanAccessToken}` },
          body: JSON.stringify({
            handle,
            paid: isPaid,
            stripe_session_id: searchParams.get("session_id"),
          }),
        });
        const data = await response.json();
        if (response.status === 402) {
          setPaywall(true);
          return;
        }
        if (!response.ok) throw new Error(data.error || "Unable to start chat");
        setConversationId(data.conversation.id);
        setRemoteMessages([]);
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
      conversations: [...current.conversations, { id: uid(), paid: isPaid, messages: [] }],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;

    if (remotePersona && conversationId) {
      setInput("");
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
          { id: uid(), from: "persona", text: data.reply, flagged: Boolean(data.flagReason), flagReason: data.flagReason },
        ]);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Message failed");
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
      window.location.href = data.url;
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
              <span className="active">{fanPath}</span>
            </div>
            <span className={`status-chip ${activePersona.status}`}>{activePersona.status}</span>
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
            <span className="active">{fanPath}</span>
            <Link href="/creator">Creator portal</Link>
          </div>
          <span className="status-chip live">AI chat</span>
        </nav>

        <header className="fan-hero">
          <div>
            <p className="section-kicker">Creator AI chat</p>
            <h1>
              Chat with <span>{activePersona.creatorName}</span>
            </h1>
            <p>
              Ask a question, get a quick answer in {activePersona.creatorName}&apos;s approved style, and keep the
              conversation going whenever you want a second opinion.
            </p>
          </div>
          <div className="fan-stats">
            <strong>{analytics.fanMessages}</strong>
            <span>fan questions answered</span>
          </div>
        </header>

        <section className="chat-layout public-chat-layout">
          <div className="chat-window">
            <div className="disclosure">
              This is {activePersona.creatorName}&apos;s AI persona, built from approved content. It is not the real
              creator, and it will step back from anything private, risky, or outside its lane.
            </div>
            <div className="chat-body">
              <div className="messages">
                {!started && (
                  <div className="empty-chat">
                    <h2>{activePersona.monetization === "free" ? "What do you want to ask?" : "Unlock this chat"}</h2>
                    <p>
                      {activePersona.monetization === "free"
                        ? "Start with a question you would naturally ask the creator."
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
                      {message.text}
                      {message.flagged && <div className="flag-label">Flagged: {message.flagReason}</div>}
                    </div>
                  ))}
              </div>
              <form onSubmit={submit} className="chat-form">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={!started}
                  placeholder={`Ask ${activePersona.creatorName.split(" ")[0] || "the creator"}'s AI something...`}
                />
                <button className="primary-btn compact">Send</button>
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
                This AI can talk about approved topics and style. It will not pretend to be the creator, give sensitive
                advice, or answer private-life questions.
              </p>
              {notice && <p className="runtime-note">{notice}</p>}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
