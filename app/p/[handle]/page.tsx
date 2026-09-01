"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { cleanHandle, findFlag, generatePersonaReply, uid, usePersonaWorkspace } from "../../persona-model";

export default function FanChatPage() {
  const { workspace, setWorkspace, analytics } = usePersonaWorkspace();
  const [started, setStarted] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [input, setInput] = useState("");
  const activeConversation = workspace.conversations[workspace.conversations.length - 1];
  const fanPath = `/p/${cleanHandle(workspace.creatorHandle)}`;

  function startConversation(paid = false) {
    setStarted(true);
    setPaywall(false);
    setWorkspace((current) => ({
      ...current,
      conversations: [...current.conversations, { id: uid(), paid, messages: [] }],
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;

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

  if (workspace.status !== "live") {
    return (
      <main className="app-shell">
        <section className="stage fan-stage">
          <nav className="top-nav">
            <Link className="brand-script" href="/">
              Persona
            </Link>
            <div className="nav-tabs">
              <Link href="/creator">Creator portal</Link>
              <span className="active">{fanPath}</span>
            </div>
            <span className={`status-chip ${workspace.status}`}>{workspace.status}</span>
          </nav>
          <div className="empty-public">
            <h1>This persona is not live yet</h1>
            <p>The creator needs to publish from the creator portal before fans can chat here.</p>
            <Link className="primary-btn" href="/creator">
              Open creator portal
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell fan-shell">
      <div className="burst burst-top" />
      <section className="stage fan-stage">
        <nav className="top-nav">
          <Link className="brand-script" href="/">
            Persona
          </Link>
          <div className="nav-tabs">
            <span className="active">{fanPath}</span>
            <Link href="/creator">Creator portal</Link>
          </div>
          <span className="status-chip live">AI chat</span>
        </nav>

        <header className="fan-hero">
          <div>
            <p className="eyebrow">Public fan URL</p>
            <h1>
              Chat with <span>{workspace.creatorName}</span>
            </h1>
            <p>
              This is a disclosed AI persona trained on creator-provided content. Boundaries are strict and visible to
              the creator.
            </p>
          </div>
          <div className="fan-stats pop-card mint-card">
            <strong>{analytics.fanMessages}</strong>
            <span>fan messages in pilot</span>
          </div>
        </header>

        <section className="chat-layout public-chat-layout">
          <div className="chat-window">
            <div className="disclosure">
              You are chatting with an AI persona trained on {workspace.creatorName}&apos;s provided content. This is not
              the real creator. Risky or off-topic questions receive a fixed fallback.
            </div>
            <div className="chat-body">
              <div className="messages">
                {!started && (
                  <div className="empty-chat">
                    <h2>{workspace.monetization === "free" ? "Start chatting" : "Unlock this chat"}</h2>
                    <p>
                      {workspace.monetization === "free"
                        ? "Fan access is free for this persona."
                        : `This creator charges $${workspace.price.toFixed(2)} per conversation.`}
                    </p>
                    <button
                      onClick={() =>
                        workspace.monetization === "free" ? startConversation(false) : setPaywall(true)
                      }
                      className="primary-btn"
                    >
                      {workspace.monetization === "free" ? "Start conversation" : "Continue to paywall"}
                    </button>
                  </div>
                )}

                {started &&
                  activeConversation.messages.map((message) => (
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
                  placeholder="Ask a question..."
                />
                <button className="primary-btn compact">Send</button>
              </form>
            </div>
          </div>

          <aside className="side-stack">
            {paywall && (
              <div className="pop-card purple-card">
                <h3>Paywall</h3>
                <p>Mock checkout for this MVP.</p>
                <strong className="price">${workspace.price.toFixed(2)}</strong>
                <button className="primary-btn" onClick={() => startConversation(true)}>
                  Pay and start chat
                </button>
              </div>
            )}
            <div className="pop-card dark-card">
              <span className="tiny-label">Boundaries</span>
              <p>Questions about identity deception, medical, legal, financial, politics, or private personal life may be flagged.</p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
