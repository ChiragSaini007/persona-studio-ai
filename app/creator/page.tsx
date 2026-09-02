"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearStoredSession, getStoredSession, resendSignupConfirmation, supabasePasswordAuth } from "../auth-client";
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

type CreatorMetrics = {
  conversations: number;
  fanMessages: number;
  flagged: number;
  fallbackRate: number;
  revenue: number;
};

export default function CreatorPortal() {
  const { workspace, setWorkspace, analytics } = usePersonaWorkspace();
  const [step, setStep] = useState(1);
  const [origin, setOrigin] = useState("");
  const [saving, setSaving] = useState(false);
  const [systemNotice, setSystemNotice] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentGiven, setConsentGiven] = useState(true);
  const [accessToken, setAccessToken] = useState("");
  const [health, setHealth] = useState<HealthState | null>(null);
  const [creatorMetrics, setCreatorMetrics] = useState<CreatorMetrics | null>(null);
  const [hasSavedPersona, setHasSavedPersona] = useState(false);
  const publicPath = `/p/${cleanHandle(workspace.creatorHandle)}`;
  const shareUrl = `${origin}${publicPath}`;
  const dashboardMetrics = creatorMetrics || {
    conversations: analytics.conversations,
    fanMessages: analytics.fanMessages,
    flagged: analytics.flagged.length,
    fallbackRate: analytics.fallbackRate,
    revenue: analytics.revenue,
  };
  const canPublish = Boolean(accessToken && health?.supabase);
  const hasCreatorProfile = Boolean(workspace.creatorName.trim() && cleanHandle(workspace.creatorHandle));
  const canContinueFromAccount = Boolean(accessToken);
  const canSubmitAuth = Boolean(
    email.trim() && password.trim() && (authMode === "signin" || (hasCreatorProfile && consentGiven)),
  );
  const canResendConfirmation = Boolean(
    email.trim() && !accessToken && systemNotice.toLowerCase().includes("confirm"),
  );
  const missingPublishItems = [
    !accessToken ? "Sign up or sign in as the creator" : "",
    health && !health.supabase ? "Publishing setup is still being finalized" : "",
    health === null ? "Waiting for backend readiness check" : "",
  ].filter(Boolean);

  useEffect(() => {
    setOrigin(window.location.origin);
    const authError = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");
    if (authError) {
      setSystemNotice(authError.replace(/\+/g, " "));
      window.history.replaceState(null, "", window.location.pathname);
    }

    const session = getStoredSession();
    if (session?.access_token) {
      setAccessToken(session.access_token);
      setEmail(session.user?.email || "");
      void loadCreatorPersona(session.access_token);
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

  async function loadCreatorPersona(token: string) {
    try {
      const response = await fetch("/api/personas?mine=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load saved persona");
      if (!data.persona) return;

      setWorkspace((current) => ({
        ...current,
        creatorName: data.persona.creator_name,
        creatorHandle: data.persona.creator_handle,
        content: data.persona.source_content,
        profile: data.persona.profile,
        enabledGuardrails: data.persona.enabled_guardrails,
        customBoundary: data.persona.custom_boundary,
        fallbackText: data.persona.fallback_text,
        monetization: data.persona.monetization,
        price: Number(data.persona.price_cents || 0) / 100,
        status: data.persona.status,
      }));
      setCreatorMetrics(data.metrics);
      setHasSavedPersona(true);
      setSystemNotice("Welcome back. Your saved persona is loaded.");
    } catch (error) {
      setSystemNotice(error instanceof Error ? error.message : "Unable to load saved persona.");
    }
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
      setSystemNotice(data.usedAI ? "Persona profile generated." : "Persona profile generated from your content.");
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
      setSystemNotice("Publishing is not available yet. Please try again in a few minutes.");
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
      if (!response.ok) throw new Error(data.error || "We could not save the persona");
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
      if (authMode === "signin") await loadCreatorPersona(session.access_token);
      setSystemNotice(authMode === "signup" ? "Creator account created. Continue to content." : "Signed in. Your workspace is ready.");
      return true;
    } catch (error) {
      setSystemNotice(error instanceof Error ? error.message : "Authentication failed");
      return false;
    }
  }

  async function continueAccountStep() {
    if (!accessToken) {
      if (authMode === "signup" && !hasCreatorProfile) {
        setSystemNotice("Add your public creator name and handle before creating the account.");
        return;
      }

      if (authMode === "signup" && !consentGiven) {
        setSystemNotice("Confirm content permission and AI disclosure before creating the account.");
        return;
      }

      const authenticated = await authenticate();
      if (authenticated) setStep(2);
      return;
    }

    setSystemNotice("");
    setStep(2);
  }

  function signOut() {
    clearStoredSession();
    setAccessToken("");
    setCreatorMetrics(null);
    setHasSavedPersona(false);
    setSystemNotice("Signed out.");
  }

  async function resendConfirmation() {
    if (!email.trim()) {
      setSystemNotice("Enter your email so we can resend the confirmation link.");
      return;
    }

    setResendingEmail(true);
    setSystemNotice("Sending a new confirmation email...");
    try {
      await resendSignupConfirmation(email);
      setSystemNotice("Confirmation email sent. Check inbox, spam, and promotions, then log in after confirming.");
    } catch (error) {
      setSystemNotice(error instanceof Error ? error.message : "Unable to resend confirmation email.");
    } finally {
      setResendingEmail(false);
    }
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
          <p>Answer the prompts in each step. We turn your approved material into a persona you can review before fans see it.</p>

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
          {systemNotice && step !== 1 && <div className="system-notice">{systemNotice}</div>}
        </aside>

        <section className="wizard-content">
          {step === 1 && (
            <div className="product-card account-card">
              <span className="section-kicker">Step 1</span>
              <div className="account-heading">
                <h2>{accessToken ? "Welcome back" : authMode === "signup" ? "Create your creator account" : "Log in to continue"}</h2>
                <p>
                  {authMode === "signup" && !accessToken
                    ? "Who is this persona for, and what public handle should fans recognize?"
                    : "Return to your saved persona, check performance, or continue editing before you publish again."}
                </p>
              </div>

              <div className={authMode === "signup" && !accessToken ? "account-layout" : "account-layout login-only"}>
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

                {authMode === "signup" && !accessToken && (
                  <section className="profile-panel">
                    <h3 className="form-section-title">Creator profile</h3>
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
                )}
              </div>

              {authMode === "signup" && !accessToken && (
                <label className="consent-row">
                  <input type="checkbox" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} />
                  I confirm I own or have permission to use this content and fans will see an AI disclosure.
                </label>
              )}

              {accessToken && hasSavedPersona && (
                <section className="returning-dashboard">
                  <div>
                    <span className="section-kicker">Saved persona</span>
                    <h3>{workspace.creatorName}</h3>
                    <p>{workspace.status === "live" ? "Your fan link is live." : "Your persona is saved as a draft."}</p>
                  </div>
                  <div className="share-url-box compact">
                    <span>Fan link</span>
                    <strong>{shareUrl}</strong>
                  </div>
                  <div className="mini-metrics">
                    <span>{dashboardMetrics.conversations} conversations</span>
                    <span>{dashboardMetrics.fanMessages} fan messages</span>
                    <span>{dashboardMetrics.fallbackRate}% fallback</span>
                  </div>
                  <div className="button-row compact-actions">
                    <Link className="secondary-action" href={publicPath}>
                      Open fan link
                    </Link>
                    <button className="secondary-action" onClick={() => setStep(5)}>
                      View metrics
                    </button>
                    <button className="secondary-action" onClick={() => setStep(2)}>
                      Edit persona
                    </button>
                  </div>
                </section>
              )}

              {systemNotice && <div className="inline-action-notice">{systemNotice}</div>}

              <div className="account-action-row">
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
                {canResendConfirmation && (
                  <button className="secondary-action" onClick={() => void resendConfirmation()} disabled={resendingEmail}>
                    {resendingEmail ? "Sending..." : "Resend confirmation"}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="product-card">
              <span className="section-kicker">Step 2</span>
              <h2>Add the words this AI can learn from</h2>
              <p>Paste only content the creator approves: captions, interviews, transcripts, posts, FAQs, or notes.</p>
              <div className="prompt-list">
                <span>What topics should this persona confidently discuss?</span>
                <span>What phrases, opinions, and examples sound unmistakably like the creator?</span>
                <span>What should fans never mistake as real-time personal access?</span>
              </div>
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
                <h2>Approve what the AI believes is “on-brand”</h2>
                <p>Check whether these topics, tone markers, and phrases match the creator before fans can chat.</p>
                <div className="prompt-list">
                  <span>Are these the topics fans actually ask about?</span>
                  <span>Does the tone feel natural, or too polished?</span>
                  <span>Which phrases should be removed before launch?</span>
                </div>
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
              <h2>Define what the persona must refuse</h2>
              <p>Set the topics and situations where the AI should stop, disclose limits, and use the creator-approved fallback.</p>
              <div className="prompt-list">
                <span>What topics create reputation risk?</span>
                <span>What private-life questions should always be blocked?</span>
                <span>What exact response should fans see when the AI cannot answer?</span>
              </div>
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
                  Review the final link, then share it where fans already follow the creator: Instagram bio, stories,
                  Linktree, broadcast channels, or fan communities.
                </p>
                <div className="prompt-list dark">
                  <span>Is the creator comfortable with this link going public?</span>
                  <span>Do the guardrails cover risky fan questions?</span>
                  <span>Who will review flagged conversations after launch?</span>
                </div>
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
                  ["Conversations", dashboardMetrics.conversations],
                  ["Fan messages", dashboardMetrics.fanMessages],
                  ["Fallback rate", `${dashboardMetrics.fallbackRate}%`],
                  ["Revenue", `$${dashboardMetrics.revenue.toFixed(2)}`],
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
