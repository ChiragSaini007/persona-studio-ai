"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cleanHandle, guardrails, makePersonaProfile, usePersonaWorkspace } from "../persona-model";

const wizardSteps = [
  { id: 1, label: "Account" },
  { id: 2, label: "Content" },
  { id: 3, label: "Persona" },
  { id: 4, label: "Safety" },
  { id: 5, label: "Publish" },
];

export default function CreatorPortal() {
  const { workspace, setWorkspace, analytics } = usePersonaWorkspace();
  const [step, setStep] = useState(1);
  const [origin, setOrigin] = useState("");
  const publicPath = `/p/${cleanHandle(workspace.creatorHandle)}`;
  const shareUrl = `${origin}${publicPath}`;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function updateField<K extends keyof typeof workspace>(field: K, value: (typeof workspace)[K]) {
    setWorkspace((current) => ({ ...current, [field]: value }));
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
    setStep(5);
  }

  async function copyShareLink() {
    if (shareUrl) await navigator.clipboard.writeText(shareUrl);
  }

  return (
    <main className="app-page">
      <nav className="product-nav">
        <Link href="/" className="wordmark">
          Persona Studio
        </Link>
        <div>
          <Link href="/">Landing</Link>
          <Link href={publicPath}>Fan page</Link>
        </div>
      </nav>

      <section className="portal-shell">
        <aside className="wizard-panel">
          <span className="section-kicker">Creator portal</span>
          <h1>Create your AI persona</h1>
          <p>Complete each step, review the output, then publish a link you can share on Instagram.</p>

          <div className="wizard-steps">
            {wizardSteps.map((item) => (
              <button
                key={item.id}
                onClick={() => setStep(item.id)}
                className={`${step === item.id ? "active" : ""} ${step > item.id || workspace.status === "live" ? "done" : ""}`}
              >
                <span>{item.id}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className={`publish-state ${workspace.status}`}>
            <strong>{workspace.status === "live" ? "Live" : workspace.status === "paused" ? "Paused" : "Draft"}</strong>
            <p>{workspace.status === "live" ? "Your fan link is ready to share." : "Your fan link unlocks after publishing."}</p>
          </div>
        </aside>

        <section className="wizard-content">
          {step === 1 && (
            <div className="product-card">
              <span className="section-kicker">Step 1</span>
              <h2>Sign up as the creator or celeb</h2>
              <p>Use your public identity. The handle becomes part of the fan chat URL.</p>
              <div className="field-grid">
                <label>
                  Creator name
                  <input value={workspace.creatorName} onChange={(event) => updateField("creatorName", event.target.value)} />
                </label>
                <label>
                  Public handle
                  <input value={workspace.creatorHandle} onChange={(event) => updateField("creatorHandle", event.target.value)} />
                </label>
              </div>
              <label className="consent-row">
                <input type="checkbox" defaultChecked />
                I confirm I own or have permission to use this content and fans will see an AI disclosure.
              </label>
              <button className="primary-action" onClick={() => setStep(2)}>
                Continue to content
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="product-card">
              <span className="section-kicker">Step 2</span>
              <h2>Upload creator-approved content</h2>
              <p>For V0, paste captions, transcripts, interviews, writing samples, or notes directly.</p>
              <textarea
                value={workspace.content}
                onChange={(event) => updateField("content", event.target.value)}
                aria-label="Creator content"
              />
              <div className="button-row">
                <button className="secondary-action" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  className="primary-action"
                  onClick={() => {
                    setWorkspace((current) => ({ ...current, profile: makePersonaProfile(current.content) }));
                    setStep(3);
                  }}
                >
                  Generate persona
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="screen-stack">
              <div className="product-card">
                <span className="section-kicker">Step 3</span>
                <h2>Review the AI persona profile</h2>
                <p>This is the creator approval gate. The fan chat should only reflect this reviewed profile.</p>
              </div>
              <div className="profile-grid">
                {[
                  ["Topics", workspace.profile.topics, "topic"],
                  ["Tone", workspace.profile.tone, "tone"],
                  ["Recurring phrases", workspace.profile.phrases, "phrase"],
                ].map(([title, items, key]) => (
                  <div key={String(title)} className="product-card mini-card">
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
              <div className="button-row">
                <button className="secondary-action" onClick={() => setStep(2)}>
                  Back
                </button>
                <button className="primary-action" onClick={() => setStep(4)}>
                  Approve profile
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="product-card">
              <span className="section-kicker">Step 4</span>
              <h2>Set safety, fallback, and payment</h2>
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
                  <input value={workspace.customBoundary} onChange={(event) => updateField("customBoundary", event.target.value)} />
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
                  <input type="number" min={1} value={workspace.price} onChange={(event) => updateField("price", Number(event.target.value))} />
                </label>
                <div className="fallback-box">
                  <strong>Fixed fallback</strong>
                  <p>{workspace.fallbackText}</p>
                </div>
              </div>
              <div className="button-row">
                <button className="secondary-action" onClick={() => setStep(3)}>
                  Back
                </button>
                <button className="primary-action" onClick={publish}>
                  Publish persona
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="screen-stack">
              <div className="launch-card">
                <span className="section-kicker">Step 5</span>
                <h2>{workspace.status === "live" ? "Your AI persona is live" : "Publish your persona"}</h2>
                <p>
                  Once live, share this link in your Instagram bio, story sticker, Linktree, broadcast channel, or fan
                  community.
                </p>
                <div className="share-url-box">
                  <span>Instagram bio link</span>
                  <strong>{workspace.status === "live" ? shareUrl : "Publish the persona to generate your fan link"}</strong>
                </div>
                <div className="button-row">
                  {workspace.status !== "live" && (
                    <button className="primary-action" onClick={publish}>
                      Make persona live
                    </button>
                  )}
                  {workspace.status === "live" && (
                    <>
                      <button className="primary-action" onClick={copyShareLink}>
                        Copy share link
                      </button>
                      <Link className="secondary-action" href={publicPath}>
                        Open fan chat
                      </Link>
                      <button className="secondary-action" onClick={() => updateField("status", "paused")}>
                        Pause persona
                      </button>
                    </>
                  )}
                </div>
              </div>

              <section className="analytics-grid">
                {[
                  ["Conversations", analytics.conversations],
                  ["Fan messages", analytics.fanMessages],
                  ["Fallback rate", `${analytics.fallbackRate}%`],
                  ["Revenue", `$${analytics.revenue.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="product-card metric-card">
                    <span>{String(label)}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </section>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
