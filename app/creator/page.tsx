"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearStoredSession, getStoredSession, supabasePasswordAuth } from "../auth-client";
import { cleanHandle, guardrails, makePersonaProfile, usePersonaWorkspace } from "../persona-model";

const wizardSteps = [
  { id: 1, label: "Account" },
  { id: 2, label: "Content" },
  { id: 3, label: "Persona" },
  { id: 4, label: "Safety" },
  { id: 5, label: "Publish" },
];

type HealthState = {
  supabase: boolean;
  openai: boolean;
  stripe: boolean;
};

export default function CreatorPortal() {
  const { workspace, setWorkspace, analytics } = usePersonaWorkspace();
  const [step, setStep] = useState(1);
  const [origin, setOrigin] = useState("");
  const [saving, setSaving] = useState(false);
  const [systemNotice, setSystemNotice] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentGiven, setConsentGiven] = useState(true);
  const [accessToken, setAccessToken] = useState("");
  const [health, setHealth] = useState<HealthState | null>(null);
  const publicPath = `/p/${cleanHandle(workspace.creatorHandle)}`;
  const shareUrl = `${origin}${publicPath}`;
  const canPublish = Boolean(accessToken && health?.supabase);
  const hasCreatorProfile = Boolean(workspace.creatorName.trim() && cleanHandle(workspace.creatorHandle));
  const canContinueFromAccount = Boolean(accessToken && hasCreatorProfile && consentGiven);
  const canSubmitAuth = Boolean(email.trim() && password.trim());
  const missingPublishItems = [
    !accessToken ? "Sign up or sign in as the creator" : "",
    health && !health.supabase ? "Add SUPABASE_SERVICE_ROLE_KEY and run the Supabase schema" : "",
    health === null ? "Waiting for backend readiness check" : "",
  ].filter(Boolean);

  useEffect(() => {
    setOrigin(window.location.origin);
    const session = getStoredSession();
    if (session?.access_token) {
      setAccessToken(session.access_token);
      setEmail(session.user?.email || "");
    }

    async function loadHealth() {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        setHealth(data);
      } catch {
        setHealth(null);
      }
    }

    void loadHealth();
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

  async function generateProfile() {
    setSystemNotice("Generating persona profile...");
    try {
      const response = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: workspace.content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Profile generation failed");
      setWorkspace((current) => ({ ...current, profile: data.profile || makePersonaProfile(current.content) }));
      setSystemNotice(data.usedAI ? "Profile generated with AI." : "Profile generated locally. Add OpenAI key for production AI.");
    } catch (error) {
      setWorkspace((current) => ({ ...current, profile: makePersonaProfile(current.content) }));
      setSystemNotice(error instanceof Error ? error.message : "Profile generated locally.");
    }
  }

  async function savePersona(status: "draft" | "live" | "paused") {
    if (!accessToken) {
      setStep(1);
      setSystemNotice("Please sign up or sign in before publishing.");
      return;
    }

    if (!health?.supabase) {
      setSystemNotice("Production storage is not connected yet. Add SUPABASE_SERVICE_ROLE_KEY and run the schema before publishing.");
      return;
    }

    setSaving(true);
    setSystemNotice(status === "live" ? "Publishing persona..." : "Saving persona...");

    try {
      const nextWorkspace = { ...workspace, status };
      const response = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          creator_name: nextWorkspace.creatorName,
          creator_handle: nextWorkspace.creatorHandle,
          source_content: nextWorkspace.content,
          profile: nextWorkspace.profile,
          enabled_guardrails: nextWorkspace.enabledGuardrails,
          custom_boundary: nextWorkspace.customBoundary,
          fallback_text: nextWorkspace.fallbackText,
          monetization: "free",
          price_cents: 0,
          status,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backend save failed");
      setWorkspace((current) => ({ ...current, status }));
      setSystemNotice(status === "live" ? "Persona is live. Share the Instagram bio link." : "Persona saved.");
    } catch (error) {
      setSystemNotice(
        error instanceof Error
          ? `${error.message}. The persona was not published.`
          : "The persona was not published.",
      );
    } finally {
      setSaving(false);
    }
  }

  function publish() {
    void savePersona("live");
    setStep(5);
  }

  async function copyShareLink() {
    if (shareUrl) await navigator.clipboard.writeText(shareUrl);
  }

  async function authenticate() {
    setSystemNotice(authMode === "signup" ? "Creating creator account..." : "Signing in...");
    try {
      const session = await supabasePasswordAuth(authMode, email, password);
      setAccessToken(session.access_token);
      setSystemNotice(authMode === "signup" ? "Creator account created. Continue to content." : "Signed in. Continue to content.");
    } catch (error) {
      setSystemNotice(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  async function continueAccountStep() {
    if (!accessToken) {
      await authenticate();
      return;
    }

    if (!hasCreatorProfile) {
      setSystemNotice("Add your public creator name and handle before continuing.");
      return;
    }

    if (!consentGiven) {
      setSystemNotice("Confirm content permission and AI disclosure before continuing.");
      return;
    }

    setSystemNotice("");
    setStep(2);
  }

  function signOut() {
    clearStoredSession();
    setAccessToken("");
    setSystemNotice("Signed out.");
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
                onClick={() => {
                  if (!accessToken && item.id > 1) {
                    setStep(1);
                    setSystemNotice("Create or sign in to a creator account before continuing.");
                    return;
                  }
                  setStep(item.id);
                }}
                className={`${step === item.id ? "active" : ""} ${step > item.id || workspace.status === "live" ? "done" : ""} ${
                  !accessToken && item.id > 1 ? "locked" : ""
                }`}
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
          {systemNotice && <div className="system-notice">{systemNotice}</div>}
          <div className="readiness-card">
            <strong>Production readiness</strong>
            <span className={health?.supabase ? "ready" : "missing"}>Supabase storage {health?.supabase ? "ready" : "missing"}</span>
            <span className={health?.openai ? "ready" : "missing"}>OpenAI {health?.openai ? "ready" : "missing"}</span>
            <span className="ready">Fan access free</span>
          </div>
        </aside>

        <section className="wizard-content">
          {step === 1 && (
            <div className="product-card account-card">
              <span className="section-kicker">Step 1</span>
              <div className="account-heading">
                <h2>{accessToken ? "Account ready" : authMode === "signup" ? "Create your creator account" : "Sign in to continue"}</h2>
                <p>
                  Use one creator account to build, publish, pause, and manage the AI persona link fans will open from
                  Instagram.
                </p>
              </div>

              <div className="account-layout">
                <section className="account-panel">
                  <div className="auth-switch" aria-label="Account mode">
                    <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
                      Sign up
                    </button>
                    <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>
                      Log in
                    </button>
                  </div>

                  {!accessToken ? (
                    <div className="account-fields">
                      <label>
                        Email
                        <input value={email} type="email" onChange={(event) => setEmail(event.target.value)} />
                      </label>
                      <label>
                        Password
                        <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} />
                      </label>
                    </div>
                  ) : (
                    <div className="connected-account">
                      <span>
                        <small>Signed in as</small>
                        <strong>{email || "Creator account"}</strong>
                      </span>
                      <button className="secondary-action" onClick={signOut}>
                        Sign out
                      </button>
                    </div>
                  )}
                </section>

                <section className="profile-panel">
                  <h3 className="form-section-title">Public profile</h3>
                  <div className="account-fields">
                    <label>
                      Creator name
                      <input value={workspace.creatorName} onChange={(event) => updateField("creatorName", event.target.value)} />
                    </label>
                    <label>
                      Public handle
                      <input value={workspace.creatorHandle} onChange={(event) => updateField("creatorHandle", event.target.value)} />
                    </label>
                  </div>
                </section>
              </div>

              <label className="consent-row">
                <input type="checkbox" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} />
                I confirm I own or have permission to use this content and fans will see an AI disclosure.
              </label>

              <button
                className="primary-action account-submit"
                onClick={() => void continueAccountStep()}
                disabled={saving || (!accessToken && !canSubmitAuth) || (accessToken && !canContinueFromAccount)}
              >
                {!accessToken
                  ? authMode === "signup"
                    ? "Create account and continue"
                    : "Log in and continue"
                  : "Continue to content"}
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
                    void generateProfile();
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
              <h2>Set safety and fallback</h2>
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
                <div className="fallback-box">
                  <strong>Access model</strong>
                  <p>Free fan access for the first production test. Paid chat can be enabled after Stripe is configured.</p>
                </div>
                <div className="fallback-box">
                  <strong>Fixed fallback</strong>
                  <p>{workspace.fallbackText}</p>
                </div>
              </div>
              <div className="button-row">
                <button className="secondary-action" onClick={() => setStep(3)}>
                  Back
                </button>
                <button className="primary-action" onClick={() => (canPublish ? publish() : setStep(5))} disabled={saving}>
                  {canPublish ? (saving ? "Publishing..." : "Publish persona") : "Review publish checklist"}
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
                {workspace.status !== "live" && (
                  <div className="publish-checklist">
                    <strong>Before this can go live</strong>
                    {missingPublishItems.length === 0 ? (
                      <p>Everything is ready. You can publish now.</p>
                    ) : (
                      <ul>
                        {missingPublishItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="button-row">
                  {workspace.status !== "live" && (
                    <button className="primary-action" onClick={publish} disabled={saving || !canPublish}>
                      {saving ? "Publishing..." : "Make persona live"}
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
                      <button className="secondary-action" onClick={() => void savePersona("paused")} disabled={saving}>
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
