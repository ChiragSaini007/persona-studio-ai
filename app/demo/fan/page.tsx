"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

const starterMessages = [
  {
    from: "fan",
    text: "What should I focus on if I want to build a serious creator product?",
  },
  {
    from: "persona",
    text: "Start with one clear fan behavior you want to earn again and again. Then build around trust, not novelty.",
  },
  {
    from: "fan",
    text: "Can you share a weekly operating principle?",
  },
  {
    from: "persona",
    text: "Keep the loop tight: publish, listen, improve, and only add complexity when the audience proves they need it.",
  },
];

const suggestedPrompts = [
  "What would you tell a first-time founder?",
  "How should I think about community?",
  "What topics are off-limits here?",
];

function simulatedReply(input: string) {
  const lower = input.toLowerCase();

  if (lower.includes("off") || lower.includes("private") || lower.includes("real")) {
    return "I cannot answer private or identity-sensitive questions. This is an AI persona, and I only respond from approved creator material.";
  }

  if (lower.includes("community")) {
    return "Community starts when people return for a shared point of view, not just a post. Give fans a reason to participate, then make that loop obvious.";
  }

  if (lower.includes("founder") || lower.includes("build")) {
    return "Pick a painful, repeated workflow and stay close to the people living it. The best product ideas survive contact with real usage.";
  }

  return "The approved lens here is practical and direct: choose one audience, understand what they repeatedly ask for, and build the smallest useful answer.";
}

export default function SimulatedFanPage() {
  const [messages, setMessages] = useState(starterMessages);
  const [input, setInput] = useState("");
  const fanMessages = useMemo(() => messages.filter((message) => message.from === "fan").length, [messages]);

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { from: "fan", text: trimmed },
      { from: "persona", text: simulatedReply(trimmed) },
    ]);
    setInput("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <main className="app-shell fan-shell">
      <section className="stage fan-stage demo-fan-stage">
        <nav className="top-nav">
          <Link className="brand-script" href="/">
            Persona Studio
          </Link>
          <div className="nav-tabs">
            <span className="active">/demo/fan</span>
            <Link href="/creator">Create yours</Link>
          </div>
          <span className="status-chip live">Demo</span>
        </nav>

        <header className="fan-hero">
          <div>
            <p className="section-kicker">Simulated fan link</p>
            <h1>
              Chat with <span>Chirag&apos;s AI</span>
            </h1>
            <p>
              This preview shows what a fan sees after a creator publishes their persona link. It uses sample content,
              clear AI disclosure, and creator-approved boundaries.
            </p>
          </div>
          <div className="fan-stats">
            <strong>{fanMessages}</strong>
            <span>sample fan prompts</span>
          </div>
        </header>

        <section className="chat-layout public-chat-layout">
          <div className="chat-window">
            <div className="disclosure">
              You are chatting with a simulated AI persona. This is not the real creator. Responses are based on approved
              example content and may refuse private, risky, or off-topic questions.
            </div>
            <div className="chat-body">
              <div className="messages">
                {messages.map((message, index) => (
                  <div key={`${message.from}-${index}`} className={`message ${message.from === "fan" ? "fan" : ""}`}>
                    {message.text}
                  </div>
                ))}
              </div>

              <div className="suggested-prompts">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="chat-form">
                <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the simulated persona..." />
                <button className="primary-btn compact">Send</button>
              </form>
            </div>
          </div>

          <aside className="side-stack">
            <div className="mint-card">
              <span className="tiny-label">What fans see</span>
              <h3>One public link, one focused chat.</h3>
              <p>No app download, no feed, no confusing setup. The fan lands directly inside the creator&apos;s AI chat.</p>
            </div>
            <div className="dark-card">
              <span className="tiny-label">Creator controls</span>
              <p>Disclosure, approved content, safety rules, fallback responses, and reviewable flagged conversations stay built in.</p>
              <Link className="light-btn" href="/creator">
                Create your persona
              </Link>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
