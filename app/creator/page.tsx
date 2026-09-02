"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearStoredSession, getStoredSession, resendSignupConfirmation, supabasePasswordAuth } from "../auth-client";
import {
  cleanHandle,
  defaultWorkspace,
  guardrails,
  makePersonaProfile,
  normalizePersonaProfile,
  usePersonaWorkspace,
} from "../persona-model";

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

type CreatorPersona = {
  id?: string;
  creator_name: string;
  creator_handle: string;
  source_content: string;
  profile: ReturnType<typeof normalizePersonaProfile>;
  enabled_guardrails: Record<string, boolean>;
  custom_boundary: string;
  fallback_text: string;
  monetization: "free" | "pay_per_conversation";
  price_cents: number;
  status: "draft" | "live" | "paused";
};

type ReviewItem = {
  id: string;
  conversationId: string;
  personaId?: string;
  personaName: string;
  text: string;
  reason: string;
  createdAt?: string;
};

export default function CreatorPortal() {
  const { workspace, setWorkspace, analytics } = usePersonaWorkspace();
  const [viewMode, setViewMode] = useState<"onboarding" | "dashboard">("onboarding");
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
  const [personaPortfolio, setPersonaPortfolio] = useState<CreatorPersona[]>([]);
  const [metricsByPersona, setMetricsByPersona] = useState<Record<string, CreatorMetrics>>({});
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [hasSavedPersona, setHasSavedPersona] = useState(false);
  const [creatingNewPersona, setCreatingNewPersona] = useState(false);
  const [profileInputs, setProfileInputs] = useState({ topics: "", tone: "", phrases: "" });
  const needsCreatorProfile = authMode === "signup" || creatingNewPersona;
  const publicPath = `/p/${cleanHandle(workspace.creatorHandle)}`;
  const shareUrl = `${origin}${publicPath}`;
  const activePersonaId = personaPortfolio.find((persona) => cleanHandle(persona.creator_handle) === cleanHandle(workspace.creatorHandle))?.id;
  const dashboardMetrics = (activePersonaId && metricsByPersona[activePersonaId]) || creatorMetrics || {
    conversations: analytics.conversations,
    fanMessages: analytics.fanMessages,
    flagged: analytics.flagged.length,
    fallbackRate: analytics.fallbackRate,
    revenue: analytics.revenue,
  };
  const canPublish = Boolean(accessToken && health?.supabase);
  const hasCreatorProfile = Boolean(workspace.creatorName.trim() && cleanHandle(workspace.creatorHandle));
  const canContinueFromAccount = Boolean(accessToken && (!creatingNewPersona || hasCreatorProfile));
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
    queueMicrotask(() => setOrigin(window.location.origin));
    const authError = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");
    if (authError) {
      queueMicrotask(() => setSystemNotice(authError.replace(/\+/g, " ")));
      window.history.replaceState(null, "", window.location.pathname);
    }

    const session = getStoredSession();
    if (session?.access_token) {
      queueMicrotask(() => {
        setAccessToken(session.access_token || "");
        setEmail(session.user?.email || "");
      });
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
        profile: normalizePersonaProfile(data.persona.profile, data.persona.source_content),
        enabledGuardrails: data.persona.enabled_guardrails,
        customBoundary: data.persona.custom_boundary,
        fallbackText: data.persona.fallback_text,
        monetization: data.persona.monetization,
        price: Number(data.persona.price_cents || 0) / 100,
        status: data.persona.status,
      }));
      setCreatorMetrics(data.metrics);
      setPersonaPortfolio(
        (data.personas || []).map((item: CreatorPersona) => ({
          ...item,
          profile: normalizePersonaProfile(item.profile, item.source_content),
        })),
      );
      setMetricsByPersona(data.metricsByPersona || {});
      setReviewQueue(data.reviewQueue || []);
      setHasSavedPersona(true);
      setCreatingNewPersona(false);
      setViewMode("dashboard");
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

  function addProfileItem(field: "topics" | "tone" | "phrases") {
    const value = profileInputs[field].trim();
    if (!value) return;

    setWorkspace((current) => {
      const existing = current.profile[field];
      if (existing.some((item) => item.toLowerCase() === value.toLowerCase())) return current;

      return {
        ...current,
        profile: {
          ...current.profile,
          [field]: [...existing, value],
        },
      };
    });
    setProfileInputs((current) => ({ ...current, [field]: "" }));
  }

  function updateProfileText(field: "bio" | "fanRelationship" | "responseStyle" | "greetingStyle", value: string) {
    setWorkspace((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: value,
      },
    }));
  }

  function updateProfileList(field: "exampleReplies" | "neverSay", value: string) {
    setWorkspace((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: value
          .split(/\n+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, field === "exampleReplies" ? 5 : 12),
      },
    }));
  }

  function selectPersona(persona: CreatorPersona) {
    setWorkspace((current) => ({
      ...current,
      creatorName: persona.creator_name,
      creatorHandle: persona.creator_handle,
      content: persona.source_content,
      profile: normalizePersonaProfile(persona.profile, persona.source_content),
      enabledGuardrails: persona.enabled_guardrails,
      customBoundary: persona.custom_boundary,
      fallbackText: persona.fallback_text,
      monetization: persona.monetization,
      price: Number(persona.price_cents || 0) / 100,
      status: persona.status,
    }));
    setCreatorMetrics(persona.id ? metricsByPersona[persona.id] : null);
    setSystemNotice("");
  }

  function removeProfileItem(field: "topics" | "tone" | "phrases", value: string) {
    setWorkspace((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: current.profile[field].filter((item) => item !== value),
      },
    }));
  }

  async function generateProfile() {
    setSystemNotice("Generating persona profile...");
    try {
      const personaBrief = [
        `Creator name: ${workspace.creatorName}`,
        `Public handle: ${workspace.creatorHandle}`,
        `About the creator: ${workspace.profile.bio}`,
        `How fans relate to them: ${workspace.profile.fanRelationship}`,
        `How the AI should talk: ${workspace.profile.responseStyle}`,
        `How the AI should greet fans: ${workspace.profile.greetingStyle}`,
        `Ideal example replies:\n${workspace.profile.exampleReplies.map((item) => `- ${item}`).join("\n")}`,
        `Never say or imply:\n${workspace.profile.neverSay.map((item) => `- ${item}`).join("\n")}`,
        "Approved creator content:",
        workspace.content,
      ].join("\n\n");
      const response = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: personaBrief }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Profile generation failed");
      setWorkspace((current) => {
        const generated = data.profile || makePersonaProfile(current.content);
        return {
          ...current,
          profile: {
            ...generated,
            bio: current.profile.bio || generated.bio,
            fanRelationship: current.profile.fanRelationship || generated.fanRelationship,
            responseStyle: current.profile.responseStyle || generated.responseStyle,
            greetingStyle: current.profile.greetingStyle || generated.greetingStyle,
          },
        };
      });
      setSystemNotice(data.usedAI ? "Persona profile generated." : "Persona profile generated from your content.");
    } catch (error) {
      setWorkspace((current) => {
        const generated = makePersonaProfile(current.content);
        return {
          ...current,
          profile: {
            ...generated,
            bio: current.profile.bio || generated.bio,
            fanRelationship: current.profile.fanRelationship || generated.fanRelationship,
            responseStyle: current.profile.responseStyle || generated.responseStyle,
            greetingStyle: current.profile.greetingStyle || generated.greetingStyle,
          },
        };
      });
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
      setHasSavedPersona(true);
      setCreatingNewPersona(false);
      if (data.persona) {
        setPersonaPortfolio((current) => {
          const normalized = {
            ...data.persona,
            profile: normalizePersonaProfile(data.persona.profile, data.persona.source_content),
          };
          const withoutCurrent = current.filter((item) => cleanHandle(item.creator_handle) !== cleanHandle(normalized.creator_handle));
          return [normalized, ...withoutCurrent];
        });
      }
      if (status === "live") setViewMode("dashboard");
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
      if (needsCreatorProfile && !hasCreatorProfile) {
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

  function startNewPersona() {
    const base = defaultWorkspace();
    setWorkspace((current) => ({
      ...current,
      creatorName: "",
      creatorHandle: "",
      content: "",
      profile: {
        ...makePersonaProfile(""),
        bio: "",
        fanRelationship: "",
        responseStyle: "",
        greetingStyle: "",
        exampleReplies: [],
        neverSay: [],
        retrievalChunks: [],
      },
      enabledGuardrails: base.enabledGuardrails,
      customBoundary: "",
      fallbackText: base.fallbackText,
      monetization: "free",
      price: 0,
      status: "draft",
    }));
    setCreatorMetrics(null);
    setReviewQueue([]);
    setCreatingNewPersona(true);
    setViewMode("onboarding");
    setStep(1);
    setSystemNotice("");
  }

  function editCurrentPersona(targetStep = 2) {
    setCreatingNewPersona(false);
    setViewMode("onboarding");
    setStep(targetStep);
    setSystemNotice("");
  }

  function signOut() {
    clearStoredSession();
    setAccessToken("");
    setCreatorMetrics(null);
    setHasSavedPersona(false);
    setCreatingNewPersona(false);
    setViewMode("onboarding");
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
          <h1>{viewMode === "dashboard" ? "Manage your AI personas" : "Create your AI persona"}</h1>
          <p>
            {viewMode === "dashboard"
              ? "Track performance, open fan links, edit live personas, or create a new persona."
              : "Answer the prompts in each step. We turn your approved material into a persona you can review before fans see it."}
          </p>

          {viewMode === "dashboard" ? (
            <div className="dashboard-nav">
              <button className="active">Overview</button>
              <button onClick={() => editCurrentPersona(2)}>Edit persona</button>
              <button onClick={startNewPersona}>New persona</button>
            </div>
          ) : (
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
          )}

          <div className={`publish-state ${workspace.status}`}>
            <strong>{workspace.status === "live" ? "Live" : workspace.status === "paused" ? "Paused" : "Draft"}</strong>
            <p>{workspace.status === "live" ? "Your fan link is ready to share." : "Your fan link unlocks after publishing."}</p>
          </div>
          {systemNotice && step !== 1 && <div className="system-notice">{systemNotice}</div>}
        </aside>

        <section className="wizard-content">
          {viewMode === "dashboard" && (
            <div className="screen-stack">
              <section className="creator-dashboard-hero">
                <div>
                  <span className="section-kicker">Creator dashboard</span>
                  <h2>{workspace.creatorName || "Your persona studio"}</h2>
                  <p>
                    Your live persona, fan link, conversation performance, and future revenue view live here after
                    onboarding.
                  </p>
                </div>
                <div className={`dashboard-status ${workspace.status}`}>
                  <span>{workspace.status}</span>
                  <strong>{workspace.status === "live" ? "Share-ready" : "Needs review"}</strong>
                </div>
              </section>

              <section className="dashboard-grid">
                <div className="product-card persona-management-card">
                  <span className="section-kicker">Persona</span>
                  <h3>{workspace.creatorName || "Untitled persona"}</h3>
                  <p>@{cleanHandle(workspace.creatorHandle)}</p>
                  <div className="share-url-box compact dashboard-link">
                    <span>Fan link</span>
                    <strong>{shareUrl}</strong>
                  </div>
                  <div className="button-row compact-actions">
                    <Link className="primary-action" href={publicPath}>
                      Open fan link
                    </Link>
                    <button className="secondary-action" onClick={() => editCurrentPersona(2)}>
                      Edit persona
                    </button>
                    <button className="secondary-action" onClick={() => void savePersona(workspace.status === "live" ? "paused" : "live")}>
                      {workspace.status === "live" ? "Pause" : "Publish"}
                    </button>
                  </div>
                </div>

                <div className="product-card persona-management-card new-persona-card">
                  <span className="section-kicker">Create more</span>
                  <h3>Launch another persona</h3>
                  <p>Create a separate AI persona for another creator, brand voice, show, or character.</p>
                  <button className="primary-action" onClick={startNewPersona}>
                    New persona
                  </button>
                </div>
              </section>

              <section className="product-card portfolio-card">
                <div className="section-heading-row">
                  <div>
                    <span className="section-kicker">Persona portfolio</span>
                    <h3>All personas</h3>
                  </div>
                  <button className="secondary-action" onClick={startNewPersona}>
                    New persona
                  </button>
                </div>
                <div className="persona-table">
                  {(personaPortfolio.length ? personaPortfolio : []).map((persona) => {
                    const metrics = persona.id ? metricsByPersona[persona.id] : undefined;
                    return (
                      <button
                        key={persona.id || persona.creator_handle}
                        className={cleanHandle(persona.creator_handle) === cleanHandle(workspace.creatorHandle) ? "active" : ""}
                        onClick={() => selectPersona(persona)}
                      >
                        <span>
                          <strong>{persona.creator_name}</strong>
                          <small>@{cleanHandle(persona.creator_handle)}</small>
                        </span>
                        <em>{persona.status}</em>
                        <span>{metrics?.conversations || 0} chats</span>
                        <span>{metrics?.fanMessages || 0} messages</span>
                        <span>{metrics?.fallbackRate || 0}% fallback</span>
                      </button>
                    );
                  })}
                  {!personaPortfolio.length && (
                    <div className="empty-state">
                      <strong>No published personas yet</strong>
                      <p>Create and publish your first persona to see it here.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="analytics-grid">
                {[
                  ["Conversations", dashboardMetrics.conversations],
                  ["Fan messages", dashboardMetrics.fanMessages],
                  ["Flagged", dashboardMetrics.flagged],
                  ["Fallback rate", `${dashboardMetrics.fallbackRate}%`],
                  ["Revenue", "$0.00"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="product-card metric-card">
                    <span>{String(label)}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </section>

              <section className="product-card future-revenue-card">
                <span className="section-kicker">Revenue</span>
                <h3>Free access is active</h3>
                <p>Revenue tracking will appear here when paid fan chat is switched on in a future release.</p>
              </section>

              <section className="product-card review-queue-card">
                <div className="section-heading-row">
                  <div>
                    <span className="section-kicker">Review queue</span>
                    <h3>Fallback and flagged conversations</h3>
                  </div>
                  <strong>{reviewQueue.length}</strong>
                </div>
                <div className="review-list">
                  {reviewQueue.slice(0, 6).map((item) => (
                    <article key={item.id}>
                      <span>{item.personaName}</span>
                      <p>{item.text}</p>
                      <small>{item.reason}</small>
                    </article>
                  ))}
                  {!reviewQueue.length && (
                    <div className="empty-state">
                      <strong>No flagged messages yet</strong>
                      <p>Risky, off-topic, or fallback-triggering fan messages will appear here for creator review.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {viewMode === "onboarding" && step === 1 && (
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

              <div className={needsCreatorProfile ? "account-layout" : "account-layout login-only"}>
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

                {needsCreatorProfile && (
                  <section className="profile-panel">
                    <h3 className="form-section-title">{creatingNewPersona ? "New persona profile" : "Creator profile"}</h3>
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
                    <button className="secondary-action" onClick={() => editCurrentPersona(5)}>
                      View metrics
                    </button>
                    <button className="secondary-action" onClick={() => editCurrentPersona(2)}>
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

          {viewMode === "onboarding" && step === 2 && (
            <div className="product-card">
              <span className="section-kicker">Step 2</span>
              <h2>Add the words this AI can learn from</h2>
              <p>Tell us who the creator is, how fans know them, and what the AI should sound like in conversation.</p>
              <div className="prompt-list">
                <span>What should a fan feel when they talk to this persona?</span>
                <span>What opinions, phrases, and stories make the creator recognizable?</span>
                <span>How should the persona handle greetings, vague messages, and short DMs?</span>
              </div>
              <div className="field-grid persona-detail-fields">
                <label>
                  About the creator
                  <textarea
                    className="compact-textarea"
                    value={workspace.profile.bio}
                    onChange={(event) => updateProfileText("bio", event.target.value)}
                    placeholder="Example: Chirag is a product and business builder focused on AI products, creator economy infrastructure, and growth."
                  />
                </label>
                <label>
                  How fans relate to them
                  <textarea
                    className="compact-textarea"
                    value={workspace.profile.fanRelationship}
                    onChange={(event) => updateProfileText("fanRelationship", event.target.value)}
                    placeholder="Example: Fans come for practical, candid advice that feels like a thoughtful voice note."
                  />
                </label>
                <label>
                  How the AI should talk
                  <textarea
                    className="compact-textarea"
                    value={workspace.profile.responseStyle}
                    onChange={(event) => updateProfileText("responseStyle", event.target.value)}
                    placeholder="Example: Use first person, be warm and direct, keep answers concise, and sound naturally opinionated."
                  />
                </label>
                <label>
                  How the AI should greet fans
                  <textarea
                    className="compact-textarea"
                    value={workspace.profile.greetingStyle}
                    onChange={(event) => updateProfileText("greetingStyle", event.target.value)}
                    placeholder="Example: Say hi naturally, keep it short, and invite the fan to ask a real question."
                  />
                </label>
              </div>
              <label className="example-replies-field">
                Ideal replies fans should receive
                <textarea
                  className="compact-textarea"
                  value={workspace.profile.exampleReplies.join("\n")}
                  onChange={(event) => updateProfileList("exampleReplies", event.target.value)}
                  placeholder={[
                    "Write 3-5 sample answers in the creator's voice, one per line.",
                    "Example: Real talk, I would start with the audience pain before building anything.",
                    "Example: My honest view is that consistency beats hacks when trust is the product.",
                  ].join("\n")}
                />
              </label>
              <label className="content-source-label">
                Approved creator content
              </label>
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

          {viewMode === "onboarding" && step === 3 && (
            <div className="screen-stack">
              <div className="product-card">
                <span className="section-kicker">Step 3</span>
                <h2>Approve how the persona will speak</h2>
                <p>Adjust the traits that become the AI&apos;s system prompt before fans ever enter the chat.</p>
                <div className="prompt-list">
                  <span>Would this feel like a natural reply from the creator&apos;s public voice?</span>
                  <span>Are the topics broad enough for fans but narrow enough to stay safe?</span>
                  <span>Which phrases feel authentic, and which feel forced?</span>
                </div>
              </div>
              <div className="product-card persona-instructions-card">
                <span className="section-kicker">System prompt inputs</span>
                <div>
                  <strong>About</strong>
                  <p>{workspace.profile.bio || "Add the creator bio in Step 2."}</p>
                </div>
                <div>
                  <strong>Fan relationship</strong>
                  <p>{workspace.profile.fanRelationship || "Add how fans relate to this creator in Step 2."}</p>
                </div>
                <div>
                  <strong>Response style</strong>
                  <p>{workspace.profile.responseStyle || "Add the desired speaking style in Step 2."}</p>
                </div>
                <div>
                  <strong>Greeting style</strong>
                  <p>{workspace.profile.greetingStyle || "Add how the persona should handle greetings in Step 2."}</p>
                </div>
                <div>
                  <strong>Example replies</strong>
                  <p>
                    {workspace.profile.exampleReplies.length
                      ? workspace.profile.exampleReplies.slice(0, 3).join(" / ")
                      : "Add 3-5 ideal answers in Step 2."}
                  </p>
                </div>
              </div>
              <div className="profile-grid">
                {[
                  ["Topics", "topics", "topic", "Add a topic fans can ask about"],
                  ["Tone", "tone", "tone", "Add a tone trait"],
                  ["Recurring phrases", "phrases", "phrase", "Add a creator phrase"],
                ].map(([title, field, key, placeholder]) => (
                  <div key={String(title)} className="product-card mini-card">
                    <h3>{String(title)}</h3>
                    <form
                      className="chip-editor"
                      onSubmit={(event) => {
                        event.preventDefault();
                        addProfileItem(field as "topics" | "tone" | "phrases");
                      }}
                    >
                      <input
                        value={profileInputs[field as "topics" | "tone" | "phrases"]}
                        placeholder={String(placeholder)}
                        onChange={(event) =>
                          setProfileInputs((current) => ({
                            ...current,
                            [field as "topics" | "tone" | "phrases"]: event.target.value,
                          }))
                        }
                      />
                      <button type="submit">Add</button>
                    </form>
                    <div className="chip-wrap">
                      {workspace.profile[field as "topics" | "tone" | "phrases"].map((item) => (
                        <span key={item} className={`pill editable ${key}`}>
                          {item}
                          <button
                            type="button"
                            aria-label={`Remove ${item}`}
                            onClick={() => removeProfileItem(field as "topics" | "tone" | "phrases", item)}
                          >
                            x
                          </button>
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

          {viewMode === "onboarding" && step === 4 && (
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
                <label>
                  Never say this
                  <textarea
                    className="compact-textarea"
                    value={workspace.profile.neverSay.join("\n")}
                    onChange={(event) => updateProfileList("neverSay", event.target.value)}
                    placeholder={[
                      "Add exact claims or phrases the persona must avoid, one per line.",
                      "Example: I can meet you privately.",
                      "Example: This is financial advice.",
                    ].join("\n")}
                  />
                </label>
                <div className="fallback-box">
                  <strong>Access model</strong>
                  <p>Fan chat is free for now. Anyone with the published link can start after logging in.</p>
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

          {viewMode === "onboarding" && step === 5 && (
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
