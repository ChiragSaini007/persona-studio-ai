"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { cleanHandle, guardrails, makePersonaProfile, usePersonaWorkspace } from "../persona-model";

export default function CreatorPortal() {
  const { workspace, setWorkspace, analytics } = usePersonaWorkspace();
  const publicPath = `/p/${cleanHandle(workspace.creatorHandle)}`;

  function updateField<K extends keyof typeof workspace>(field: K, value: (typeof workspace)[K]) {
    setWorkspace((current) => ({ ...current, [field]: value }));
  }

  function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateField("status", "draft");
  }

  function toggleGuardrail(key: string) {
    const rail = guardrails.find((item) => item.key === key);
    if (rail?.locked) return;
    setWorkspace((current) => ({
      ...current,
      enabledGuardrails: { ...current.enabledGuardrails, [key]: !current.enabledGuardrails[key] },
    }));
  }

  function publish() {
    setWorkspace((current) => ({ ...current, status: "live" }));
  }

  return (
    <main className="app-shell">
      <div className="burst burst-top" />
      <div className="burst burst-left" />
      <section className="stage">
        <nav className="top-nav">
          <Link className="brand-script" href="/">
            Persona
          </Link>
          <div className="nav-tabs">
            <a href="#setup" className="active">
              Setup
            </a>
            <a href="#studio">Studio</a>
            <a href="#dashboard">Dashboard</a>
            <Link href={publicPath}>Fan URL</Link>
          </div>
          <span className={`status-chip ${workspace.status}`}>{workspace.status}</span>
        </nav>

        <header className="portal-head">
          <div className="hero-copy">
            <p className="eyebrow">Creator portal</p>
            <h1>
              Train, control, and publish your <span>AI persona</span>
            </h1>
          </div>
          <div className="share-card">
            <span className="tiny-label">Live fan URL</span>
            <strong>{workspace.status === "live" ? publicPath : "Publish to unlock"}</strong>
            <p>{workspace.status === "live" ? "Fans can now chat on a separate public page." : "The link appears once your persona is live."}</p>
            <Link className="primary-btn" href={publicPath}>
              Open fan page
            </Link>
          </div>
        </header>

        <section className="creator-layout">
          <div className="screen-stack">
            <form id="setup" onSubmit={signUp} className="pop-card main-card">
              <p className="tiny-label">1. Account</p>
              <h2>Creator signup</h2>
              <p>Creators and celebs can sign up directly. No invite gate in this MVP.</p>
              <div className="field-grid">
                <label>
                  Creator name
                  <input
                    value={workspace.creatorName}
                    onChange={(event) => updateField("creatorName", event.target.value)}
                  />
                </label>
                <label>
                  Public handle
                  <input
                    value={workspace.creatorHandle}
                    onChange={(event) => updateField("creatorHandle", event.target.value)}
                  />
                </label>
              </div>
              <label className="check-row">
                <input type="checkbox" defaultChecked />
                I own or have permission to use this content and accept that fans see an AI disclosure.
              </label>
            </form>

            <section id="studio" className="pop-card main-card">
              <div className="split-head">
                <div>
                  <p className="tiny-label">2. Studio</p>
                  <h2>Upload content and generate persona</h2>
                  <p>Paste captions, transcripts, interviews, writing samples, or creator-approved notes.</p>
                </div>
                <button
                  className="secondary-btn"
                  onClick={() =>
                    setWorkspace((current) => ({ ...current, profile: makePersonaProfile(current.content) }))
                  }
                >
                  Generate profile
                </button>
              </div>
              <textarea
                value={workspace.content}
                onChange={(event) => updateField("content", event.target.value)}
                aria-label="Creator content"
              />
            </section>

            <section className="profile-grid">
              {[
                ["Topics", workspace.profile.topics, "topic"],
                ["Tone", workspace.profile.tone, "tone"],
                ["Recurring phrases", workspace.profile.phrases, "phrase"],
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
            </section>

            <section className="pop-card main-card">
              <p className="tiny-label">3. Controls</p>
              <h2>Guardrails and monetization</h2>
              <p>Flagged means a fan interaction touched a safety rule, blocked topic, identity boundary, or fallback path.</p>
              <div className="guardrail-grid">
                {guardrails.map((rail) => (
                  <label key={rail.key} className="guardrail-card">
                    <span>
                      <input
                        type="checkbox"
                        checked={workspace.enabledGuardrails[rail.key]}
                        disabled={rail.locked}
                        onChange={() => toggleGuardrail(rail.key)}
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
                    value={workspace.customBoundary}
                    onChange={(event) => updateField("customBoundary", event.target.value)}
                  />
                </label>
                <label>
                  Access model
                  <select
                    value={workspace.monetization}
                    onChange={(event) => updateField("monetization", event.target.value as typeof workspace.monetization)}
                  >
                    <option value="free">Free fan access</option>
                    <option value="pay_per_conversation">Paid per conversation</option>
                  </select>
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    min={1}
                    value={workspace.price}
                    onChange={(event) => updateField("price", Number(event.target.value))}
                  />
                </label>
                <div className="fallback-box">
                  <strong>Fixed fallback</strong>
                  <p>{workspace.fallbackText}</p>
                </div>
              </div>
            </section>
          </div>

          <aside className="side-stack">
            <div className="pop-card purple-card">
              <span className="tiny-label">Publish</span>
              <h3>{workspace.creatorName}</h3>
              <p>Make the persona live, pause it instantly, or open the separate fan page.</p>
              <div className="button-column">
                <button className="primary-btn" onClick={publish}>
                  Make persona live
                </button>
                <button className="secondary-btn" onClick={() => updateField("status", "paused")}>
                  Pause persona
                </button>
                <Link className="light-btn" href={publicPath}>
                  Open {publicPath}
                </Link>
              </div>
            </div>

            <section id="dashboard" className="pop-card dark-card">
              <span className="tiny-label">Dashboard</span>
              <div className="dashboard-stack">
                <div>
                  <strong>{analytics.conversations}</strong>
                  <span>Conversations</span>
                </div>
                <div>
                  <strong>{analytics.fallbackRate}%</strong>
                  <span>Fallback rate</span>
                </div>
                <div>
                  <strong>${analytics.revenue.toFixed(2)}</strong>
                  <span>Revenue</span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
