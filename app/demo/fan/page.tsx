"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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
  "How do I become a better PM?",
  "Explain this with numbers",
  "Do a case study with me",
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
            <Link href="/creator">Create yours</Link>
          </div>
        </nav>

        <header className="fan-hero">
          <div>
            <p className="section-kicker">AI persona</p>
            <h1>
              Chat with <span>Chirag</span>
            </h1>
            <p>Ask what you would normally DM Chirag. The AI replies from his approved public material.</p>
          </div>
        </header>

        <section className="chat-layout public-chat-layout">
          <div className="chat-window">
            <div className="dm-thread-header">
              <div className="dm-avatar photo">CS</div>
              <div>
                <strong>Chirag</strong>
                <span>AI persona</span>
              </div>
              <em>AI</em>
            </div>
            <div className="disclosure">Based on Chirag&apos;s approved public material. Private or risky requests are blocked.</div>
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
                <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Chirag's AI..." />
                <button className="primary-btn compact">Send</button>
              </form>
            </div>
          </div>

          <aside className="side-stack">
            <div className="dark-card fan-preview-note">
              <span className="tiny-label">Creator-approved</span>
              <p>Voice, languages, and topics to avoid are reviewed before the link goes live.</p>
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
