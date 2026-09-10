"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  { id: 2, label: "Public material" },
  { id: 3, label: "AI voice" },
  { id: 4, label: "Topics to avoid" },
  { id: 5, label: "Fan link" },
];

const languageOptions = ["English", "Hinglish", "Hindi", "Tamil", "Telugu", "Kannada", "Bengali", "Marathi", "Spanish"];

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
  const searchParams = useSearchParams();
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
  const [customLanguage, setCustomLanguage] = useState("");
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
  const canContinueFromAccount = Boolean(accessToken);
  const canSubmitAuth = Boolean(email.trim() && password.trim());
  const accountActionHint =
    !accessToken && !email.trim()
      ? "Add your email to continue."
      : !accessToken && !password.trim()
        ? "Add a password to continue."
        : "";
  const canResendConfirmation = Boolean(
    email.trim() && !accessToken && systemNotice.toLowerCase().includes("confirm"),
  );
  const missingPublishItems = [
    !accessToken ? "Sign up or sign in as the creator" : "",
    health && !health.supabase ? "Publishing setup is still being finalized" : "",
    health === null ? "Waiting for backend readiness check" : "",
  ].filter(Boolean);
  const creatorFirstName = workspace.creatorName.trim().split(" ")[0] || "the creator";
  const livePreviewQuestion = workspace.profile.topics[0]
    ? `How should I think about ${workspace.profile.topics[0].toLowerCase()}?`
    : "What should I focus on first?";
  const livePreviewAnswer =
    workspace.profile.exampleReplies[0] ||
    workspace.profile.responseStyle ||
    `I would keep it simple. Start with the real problem, make one useful move, and build from what fans already trust ${creatorFirstName} for.`;
  const activeGuardrailCount = Object.values(workspace.enabledGuardrails).filter(Boolean).length;
  const approvedSourceCount = workspace.content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean).length;
  const dashboardSignals = [
    ["Public material", approvedSourceCount || workspace.profile.retrievalChunks.length || 0],
    ["Languages", workspace.profile.supportedLanguages.length],
    ["Topics to avoid", activeGuardrailCount],
    ["Example replies", workspace.profile.exampleReplies.length],
  ];

  const loadCreatorPersona = useCallback(async (token: string) => {
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
  }, [setWorkspace]);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "onboarding") {
      queueMicrotask(() => {
        setViewMode("onboarding");
        setStep(1);
      });
    }
    if (requestedMode === "review") {
      queueMicrotask(() => setViewMode("dashboard"));
    }

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
      queueMicrotask(() => void loadCreatorPersona(session.access_token));
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
  }, [loadCreatorPersona, searchParams]);

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

  function toggleLanguage(language: string) {
    setWorkspace((current) => {
      const exists = current.profile.supportedLanguages.some((item) => item.toLowerCase() === language.toLowerCase());
      const nextLanguages = exists
        ? current.profile.supportedLanguages.filter((item) => item.toLowerCase() !== language.toLowerCase())
        : [...current.profile.supportedLanguages, language];

      return {
        ...current,
        profile: {
          ...current.profile,
          supportedLanguages: nextLanguages.length ? nextLanguages : ["English"],
        },
      };
    });
  }

  function addCustomLanguage() {
    const language = customLanguage.trim();
    if (!language) return;
    toggleLanguage(language);
    setCustomLanguage("");
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
        `Languages the creator is comfortable chatting in: ${workspace.profile.supportedLanguages.join(", ")}`,
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
            supportedLanguages: current.profile.supportedLanguages.length
              ? current.profile.supportedLanguages
              : generated.supportedLanguages,
          },
        };
      });
      setSystemNotice(data.usedAI ? "AI voice draft is ready." : "AI voice drafted from your public material.");
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
            supportedLanguages: current.profile.supportedLanguages.length
              ? current.profile.supportedLanguages
              : generated.supportedLanguages,
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
    setSystemNotice(status === "live" ? "Making fan link live..." : "Saving changes...");

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
      setSystemNotice(status === "live" ? "Fan link is live. Share it anywhere fans follow you." : "Changes saved.");
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
        supportedLanguages: ["English", "Hinglish"],
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
          <Link href="/">Home</Link>
          <Link href="/creator/onboarding">Create</Link>
          <Link href="/creator/review">Review</Link>
          <Link href={publicPath}>Fan link</Link>
        </div>
      </nav>

      <section className="portal-shell">
        <aside className="wizard-panel">
          <span className="section-kicker">Creator portal</span>
          <h1>{viewMode === "dashboard" ? "Manage your AI personas" : "Create your AI persona"}</h1>
          <p>
            {viewMode === "dashboard"
              ? "Your live personas, fan links, messages to review, and metrics in one place."
              : "Add public material. We draft the AI voice, topics, and fan preview. You approve before it goes live."}
          </p>

          {viewMode === "dashboard" ? (
            <div className="dashboard-nav">
              <button className="active">Overview</button>
              <button onClick={() => editCurrentPersona(2)}>Edit persona</button>
              <Link href="/creator/review">Needs review</Link>
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
                    See what is live, what fans ask, what needs review, and create the next persona from here.
                  </p>
                </div>
                <div className={`dashboard-status ${workspace.status}`}>
                  <span>{workspace.status}</span>
                  <strong>{workspace.status === "live" ? "Ready to share" : "Draft"}</strong>
                </div>
              </section>

              <section className="creator-signal-strip" aria-label="Persona readiness signals">
                {dashboardSignals.map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{String(label)}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </section>

              <section className="dashboard-grid">
                <div className="product-card persona-management-card">
                  <span className="section-kicker">Selected persona</span>
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
                  <h3>Build another voice</h3>
                  <p>Create a separate persona for another creator, show, character, or content lane.</p>
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
                        <span>{metrics?.fallbackRate || 0}% step-back</span>
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
                  ["Needs review", dashboardMetrics.flagged],
                  ["Step-back rate", `${dashboardMetrics.fallbackRate}%`],
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
                    <span className="section-kicker">Needs review</span>
                    <h3>Messages that need a look</h3>
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
                      <strong>No messages need review yet</strong>
                      <p>Private, risky, or unclear fan messages will appear here.</p>
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
                <h2>{accessToken ? "Welcome back" : authMode === "signup" ? "Create your account" : "Log in to continue"}</h2>
                <p>
                  {authMode === "signup" && !accessToken
                    ? "One account lets you create personas, edit them later, and see fan conversations."
                    : "Return to your personas, check performance, or keep editing before you publish again."}
                </p>
              </div>

              <div className="account-layout login-only">
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
              </div>

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
                    <span>{dashboardMetrics.fallbackRate}% step-back</span>
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
                {accountActionHint && <p className="inline-form-hint">{accountActionHint}</p>}
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
              <h2>Add your public material</h2>
              <p>Paste what fans already see from you. We will draft the AI voice, fan topics, sample replies, and welcome message.</p>

              <div className="creator-setup-grid">
                <section className="profile-panel">
                  <h3 className="form-section-title">{creatingNewPersona ? "Who is this persona for?" : "Creator details"}</h3>
                  <div className="account-fields">
                    <label>
                      Creator name
                      <input
                        value={workspace.creatorName}
                        onChange={(event) => updateField("creatorName", event.target.value)}
                        placeholder="Chirag Saini"
                      />
                    </label>
                    <label>
                      Public handle
                      <input
                        value={workspace.creatorHandle}
                        onChange={(event) => updateField("creatorHandle", event.target.value)}
                        placeholder="@chirag"
                      />
                    </label>
                  </div>
                </section>

                <aside className="live-preview-card">
                  <span className="section-kicker">Live fan preview</span>
                  <div className="preview-phone">
                    <div className="preview-header">
                      <strong>{workspace.creatorName || "Creator"}&apos;s AI</strong>
                      <span>Preview</span>
                    </div>
                    <div className="preview-bubble ai">
                      {workspace.profile.greetingStyle || `Hey, I am ${creatorFirstName}'s AI. Ask me anything they usually talk about.`}
                    </div>
                    <div className="preview-bubble fan">{livePreviewQuestion}</div>
                    <div className="preview-bubble ai">{livePreviewAnswer}</div>
                    <div className="preview-source-strip">
                      <span>{approvedSourceCount || workspace.profile.retrievalChunks.length || 0} material blocks</span>
                      <span>{workspace.profile.supportedLanguages.length} languages</span>
                    </div>
                  </div>
                </aside>
              </div>

              <section className="source-builder">
                <div>
                  <span className="section-kicker">Public material</span>
                  <h3>Paste captions, transcripts, posts, notes, or FAQs</h3>
                  <p>Use material the creator is comfortable being represented by. The more specific it is, the more grounded fan replies become.</p>
                </div>
                <textarea
                  value={workspace.content}
                  onChange={(event) => updateField("content", event.target.value)}
                  aria-label="Creator public material"
                  placeholder={[
                    "Paste approved public material here.",
                    "",
                    "Good examples:",
                    "- Instagram captions",
                    "- YouTube transcripts",
                    "- Interview answers",
                    "- Newsletter posts",
                    "- Product or career advice you often give",
                  ].join("\n")}
                />
              </section>

              <section className="source-builder language-builder">
                <div>
                  <span className="section-kicker">Languages</span>
                  <h3>Which languages can your AI reply in?</h3>
                  <p>Pick only the languages or mixed styles that feel natural for the creator.</p>
                </div>
                <div className="language-selector">
                  <div className="chip-wrap">
                    {languageOptions.map((language) => {
                      const selected = workspace.profile.supportedLanguages.some(
                        (item) => item.toLowerCase() === language.toLowerCase(),
                      );
                      return (
                        <button
                          key={language}
                          type="button"
                          className={`pill editable tone ${selected ? "selected" : ""}`}
                          onClick={() => toggleLanguage(language)}
                        >
                          {language}
                        </button>
                      );
                    })}
                  </div>
                  <form
                    className="chip-editor"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addCustomLanguage();
                    }}
                  >
                    <input
                      value={customLanguage}
                      placeholder="Add another language"
                      onChange={(event) => setCustomLanguage(event.target.value)}
                    />
                    <button type="submit">Add</button>
                  </form>
                </div>
              </section>

              <section className="source-builder optional-builder">
                <div>
                  <span className="section-kicker">Optional polish</span>
                  <h3>Add 3-5 replies that sound exactly right</h3>
                  <p>Skip this if you want. A few examples help the AI learn your rhythm faster.</p>
                </div>
                <textarea
                  className="compact-textarea"
                  value={workspace.profile.exampleReplies.join("\n")}
                  onChange={(event) => updateProfileList("exampleReplies", event.target.value)}
                  placeholder={[
                    "Question: How do I become a better PM? Answer: Start by getting sharper at problem discovery...",
                    "Question: How should I evaluate a startup idea? Answer: I would first ask who feels the pain...",
                    "Question: Can you explain this with numbers? Answer: Yes. I would break it into users, frequency, conversion, and revenue...",
                  ].join("\n")}
                />
              </section>
              <div className="button-row">
                <button className="secondary-action" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  className="primary-action"
                  onClick={() => {
                    if (!hasCreatorProfile) {
                      setSystemNotice("Add the creator name and public handle first.");
                      return;
                    }
                    void generateProfile();
                    setStep(3);
                  }}
                >
                  Draft my AI voice
                </button>
              </div>
            </div>
          )}

          {viewMode === "onboarding" && step === 3 && (
            <div className="screen-stack">
              <div className="product-card">
                <span className="section-kicker">Step 3</span>
                <h2>Review your AI voice</h2>
                <p>We drafted this from your public material. Keep what feels right, remove what does not, then test the fan experience.</p>
                <div className="prompt-list">
                  <span>Would fans recognize this as your public point of view?</span>
                  <span>Are these the topics you actually want to answer?</span>
                  <span>Do any phrases feel fake or overused?</span>
                </div>
              </div>
              <div className="product-card persona-instructions-card">
                <span className="section-kicker">Drafted for you</span>
                <div>
                  <strong>Who fans are talking to</strong>
                  <p>{workspace.profile.bio || "Add the creator bio in Step 2."}</p>
                </div>
                <div>
                  <strong>Why fans come here</strong>
                  <p>{workspace.profile.fanRelationship || "We will infer this from stronger public material."}</p>
                </div>
                <div>
                  <strong>How replies should feel</strong>
                  <p>{workspace.profile.responseStyle || "We will infer this from your example replies and public content."}</p>
                </div>
                <div>
                  <strong>First message fans see</strong>
                  <p>{workspace.profile.greetingStyle || `Hey, good to see you here. Ask me anything you would normally ask ${creatorFirstName}.`}</p>
                </div>
                <div>
                  <strong>Languages</strong>
                  <p>{workspace.profile.supportedLanguages.join(", ") || "English"}</p>
                </div>
                <div>
                  <strong>Replies to copy</strong>
                  <p>
                    {workspace.profile.exampleReplies.length
                      ? workspace.profile.exampleReplies.slice(0, 3).join(" / ")
                      : "Optional. Add 3-5 ideal answers in Step 2 if you want tighter style."}
                  </p>
                </div>
              </div>
              <div className="profile-grid">
                {[
                  ["Topics", "topics", "topic", "Add a topic fans can ask about"],
                  ["Reply style", "tone", "tone", "Add a style trait"],
                  ["Phrases that sound like you", "phrases", "phrase", "Add a phrase"],
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
                  Looks right
                </button>
              </div>
            </div>
          )}

          {viewMode === "onboarding" && step === 4 && (
            <div className="product-card">
              <span className="section-kicker">Step 4</span>
              <h2>Choose topics to avoid</h2>
              <p>These protect the creator. The AI will politely step back when fans ask for private, risky, or off-topic answers.</p>
              <div className="prompt-list">
                <span>What should never be answered on your behalf?</span>
                <span>What private-life questions should always be blocked?</span>
                <span>What should the AI say when it cannot answer?</span>
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
                  <strong>Fan access</strong>
                  <p>Free for now. Fans sign in once, then continue from their own chat history.</p>
                </div>
                <div className="fallback-box">
                  <strong>When the AI cannot answer</strong>
                  <p>{workspace.fallbackText}</p>
                </div>
              </div>
              <label className="consent-row">
                <input type="checkbox" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} />
                <span>I own or have permission to use this material, and fans will see that this is an AI persona.</span>
              </label>
              <div className="button-row">
                <button className="secondary-action" onClick={() => setStep(3)}>
                  Back
                </button>
                <button
                  className="primary-action"
                  onClick={() => {
                    if (!consentGiven) {
                      setSystemNotice("Confirm permission and AI disclosure before going live.");
                      return;
                    }
                    if (canPublish) {
                      publish();
                    } else {
                      setStep(5);
                    }
                  }}
                  disabled={saving}
                >
                  {canPublish ? (saving ? "Making live..." : "Make fan link live") : "Review launch checklist"}
                </button>
              </div>
            </div>
          )}

          {viewMode === "onboarding" && step === 5 && (
            <div className="screen-stack">
              <div className="launch-card">
                <span className="section-kicker">Step 5</span>
                <h2>{workspace.status === "live" ? "Your fan link is live" : "Make your fan link live"}</h2>
                <p>
                  Share it where fans already follow you: Instagram bio, stories, Linktree, broadcast channels, or fan communities.
                </p>
                <div className="prompt-list dark">
                  <span>Are you comfortable with this link going public?</span>
                  <span>Do the topics to avoid cover risky fan questions?</span>
                  <span>Who will check messages that need review?</span>
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
                    <button className="primary-action" onClick={publish} disabled={saving || !canPublish || !consentGiven}>
                      {saving ? "Making live..." : "Make fan link live"}
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
                  ["Step-back rate", `${dashboardMetrics.fallbackRate}%`],
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
