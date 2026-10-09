"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clearStoredSession, getStoredSession, refreshStoredSession, resendSignupConfirmation, supabasePasswordAuth } from "../auth-client";
import {
  cleanHandle,
  defaultWorkspace,
  guardrails,
  makePersonaProfile,
  normalizePersonaProfile,
  usePersonaWorkspace,
} from "../persona-model";

function suggestHandle(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "").slice(0, 24);
}

const consentText =
  "I am this creator, or I have their written permission to create this AI persona. I own or may use this material, and I understand fans will always be told they are talking to an AI.";

const sampleMaterial = [
  "I think the best creators treat every post as a conversation, not a broadcast. When someone comments, I reply with a real answer, not a thank-you emoji.",
  "My rule for consistency: pick one format you can publish weekly for a year. Quality compounds; novelty burns out.",
  "People ask me how to grow from zero. Start with one clear promise, show your work in public, and ask your first 100 followers what they actually want more of.",
].join("\n\n");

const wizardSteps = [
  { id: 1, label: "Sign in" },
  { id: 2, label: "Your content" },
  { id: 3, label: "Review your voice" },
  { id: 4, label: "Set boundaries" },
  { id: 5, label: "Launch" },
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
  role?: "fan" | "persona";
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
  const [consentGiven, setConsentGiven] = useState(false);
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
  const [dashTab, setDashTab] = useState<"overview" | "review" | "channels">("overview");
  const [showStep2Errors, setShowStep2Errors] = useState(false);
  const [personaChecked, setPersonaChecked] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
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
  const step2Errors = {
    creatorName: workspace.creatorName.trim() ? "" : "Enter the creator's name.",
    creatorHandle: workspace.creatorHandle.trim().replace(/^@/, "") ? "" : "Choose a public handle, like @priya.",
    content: workspace.content.trim().length >= 40 ? "" : "Paste at least a few sentences of public material so the AI has something real to learn from.",
    consent: consentGiven ? "" : "Confirm consent to continue. Nothing can be drafted without it.",
  };
  const step2ErrorList = (Object.entries(step2Errors) as [keyof typeof step2Errors, string][]).filter(([, message]) => message);
  const isDraftOnly = creatingNewPersona || !hasSavedPersona;  const reviewGroups = Array.from(
    reviewQueue
      .reduce((groups, item) => {
        const key = item.conversationId || item.id;
        const group = groups.get(key) || { key, personaName: item.personaName, reason: item.reason, items: [] as ReviewItem[] };
        group.items.push(item);
        groups.set(key, group);
        return groups;
      }, new Map<string, { key: string; personaName: string; reason: string; items: ReviewItem[] }>())
      .values(),
  ).map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => (a.role === "fan" ? -1 : 1) - (b.role === "fan" ? -1 : 1)),
    reason: group.items.find((item) => item.role === "fan")?.reason || group.reason,
  }));
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

  const handledRate = Math.max(0, 100 - (dashboardMetrics.fallbackRate || 0));
  const minutesSaved = Math.round(dashboardMetrics.fanMessages * 2);
  const loopVerdict =
    workspace.status !== "live"
      ? {
          headline: "Not live yet, so there is nothing to judge.",
          detail: "Publish your fan link, then share it. Within a day you will see who is chatting and what they ask.",
        }
      : dashboardMetrics.conversations === 0
        ? {
            headline: "Live, but no fans have chatted yet.",
            detail: "Put your fan link in your bio or a story. Results will show up here as soon as fans start talking.",
          }
        : {
            headline: `${dashboardMetrics.conversations} ${dashboardMetrics.conversations === 1 ? "fan has" : "fans have"} chatted. ${handledRate}% of replies were handled without you.`,
            detail: `That is roughly ${minutesSaved} minutes of replies you did not have to write (estimated at 2 minutes each). Check the review queue before you decide how much to invest.`,
          };
  const loopSteps = [
    { label: "Content connected", value: `${approvedSourceCount || workspace.profile.retrievalChunks.length || 0} pieces`, note: "Add more to sharpen answers", done: true },
    { label: "AI trained", value: hasSavedPersona ? "Ready" : "Draft", note: `${workspace.profile.supportedLanguages.length} languages`, done: hasSavedPersona },
    { label: "Fans chatting", value: String(dashboardMetrics.conversations), note: "Conversations so far", done: dashboardMetrics.conversations > 0 },
    { label: "Engagement", value: String(dashboardMetrics.fanMessages), note: `${handledRate}% handled without you`, done: dashboardMetrics.fanMessages > 0 },
    { label: "Revenue", value: `$${Number(dashboardMetrics.revenue || 0).toFixed(2)}`, note: "Free access. Paid chat is coming", done: false },
  ];

  const loadCreatorPersona = useCallback(async (token: string) => {
    try {
      const fetchMine = (accessToken: string) =>
        fetch("/api/personas?mine=true", { headers: { Authorization: `Bearer ${accessToken}` } });
      let response = await fetchMine(token);
      if (response.status === 401) {
        const refreshed = await refreshStoredSession();
        if (!refreshed?.access_token) {
          setAccessToken("");
          setEmail("");
          setSystemNotice("Your session expired. Please log in again.");
          setAuthMode("signin");
          return;
        }
        setAccessToken(refreshed.access_token);
        response = await fetchMine(refreshed.access_token);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load saved persona");
      if (!data.persona) {
        setStep((current) => (current === 1 ? 2 : current));
        return;
      }

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
      if (data.persona.profile?.consent?.givenAt) setConsentGiven(true);
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
      const wantsOnboarding = new URLSearchParams(window.location.search).get("mode") === "onboarding";
      if (!wantsOnboarding) setViewMode("dashboard");
      setSystemNotice("");
    } catch (error) {
      setSystemNotice(error instanceof Error ? error.message : "Unable to load saved persona.");
    } finally {
      setPersonaChecked(true);
    }
  }, [setWorkspace]);

  useEffect(() => {
    if (viewMode === "dashboard" && dashTab === "review") {
      const timer = window.setTimeout(() => document.getElementById("needs-review")?.scrollIntoView({ block: "start" }), 150);
      return () => window.clearTimeout(timer);
    }
  }, [viewMode, dashTab, reviewQueue.length]);

  useEffect(() => {
    if (viewMode !== "onboarding") return;
    const timer = window.setTimeout(() => window.scrollTo({ top: 0 }), 0);
    return () => window.clearTimeout(timer);
  }, [step, viewMode]);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "onboarding") {
      queueMicrotask(() => {
        setViewMode("onboarding");
        setStep(1);
      });
    }
    if (requestedMode === "review") {
      queueMicrotask(() => {
        setViewMode("dashboard");
        setDashTab("review");
      });
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
    setConsentGiven(false);
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ content: personaBrief, consent: consentGiven }),
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

    if (status !== "paused" && !consentGiven) {
      setStep(5);
      setViewMode("onboarding");
      setShowConsentError(true);
      setSystemNotice("Confirm your consent first. Nothing is saved or published without it.");
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
          consent: consentGiven,
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
    setConsentGiven(false);
    setShowStep2Errors(false);
    setCreatingNewPersona(true);
    setViewMode("onboarding");
    setStep(accessToken ? 2 : 1);
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
    setConsentGiven(false);
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

  const statusLabel =
    accessToken && !personaChecked
      ? "Loading"
      : isDraftOnly
        ? "Draft"
        : workspace.status === "live"
          ? "Live"
          : workspace.status === "paused"
            ? "Paused"
            : "Draft";
  const statusTone = statusLabel === "Live" ? "live" : statusLabel === "Paused" ? "paused" : "draft";
  const avatarTitle = workspace.creatorName.trim() || "Your AI avatar";

  return (
    <div className="console">
      <header className="console-topbar">
        <Link href="/" className="wordmark">
          Fanline
        </Link>
        <span className="console-crumb">Creator console</span>
        <div className="console-topbar-right">
          <Link href="/demo/fan">Demo</Link>
          {accessToken && hasSavedPersona && workspace.status === "live" && <Link href={publicPath}>View public avatar</Link>}
          {accessToken && (
            <span className="account-chip">
              <span title={email}>{email}</span>
              <button type="button" onClick={signOut}>
                Sign out
              </button>
            </span>
          )}
        </div>
      </header>

      <div className={`console-body ${accessToken ? "" : "no-nav"}`}>
        {accessToken && (
          <aside className="console-nav" aria-label="Console navigation">
            <nav>
              <button
                className={viewMode === "dashboard" && dashTab === "overview" ? "active" : ""}
                aria-current={viewMode === "dashboard" && dashTab === "overview" ? "page" : undefined}
                onClick={() => {
                  setViewMode("dashboard");
                  setDashTab("overview");
                }}
                disabled={!hasSavedPersona}
              >
                Overview
              </button>
              <button
                className={viewMode === "onboarding" ? "active" : ""}
                aria-current={viewMode === "onboarding" ? "page" : undefined}
                onClick={() => (hasSavedPersona ? editCurrentPersona(2) : setViewMode("onboarding"))}
              >
                Avatar
              </button>
              <button
                className={viewMode === "dashboard" && dashTab === "review" ? "active" : ""}
                aria-current={viewMode === "dashboard" && dashTab === "review" ? "page" : undefined}
                onClick={() => {
                  setViewMode("dashboard");
                  setDashTab("review");
                }}
                disabled={!hasSavedPersona}
              >
                Conversations{reviewGroups.length ? <em>{reviewGroups.length}</em> : null}
              </button>
              <button
                className={viewMode === "dashboard" && dashTab === "channels" ? "active" : ""}
                aria-current={viewMode === "dashboard" && dashTab === "channels" ? "page" : undefined}
                onClick={() => {
                  setViewMode("dashboard");
                  setDashTab("channels");
                }}
                disabled={!hasSavedPersona}
              >
                Channels
              </button>
              <button disabled>
                Revenue<small>Soon</small>
              </button>
            </nav>
            <div className="console-nav-foot">
              <span className={`status-pill ${statusTone}`}>{statusLabel}</span>
              <button className="secondary-action" onClick={startNewPersona}>
                New avatar
              </button>
            </div>
          </aside>
        )}

        <main className="console-main">
          {systemNotice && step !== 1 && viewMode === "onboarding" && (
            <div className="system-notice" role="status">
              {systemNotice}
            </div>
          )}

          {viewMode === "onboarding" && (
            <ol className="stepper" aria-label="Avatar setup progress">
              {wizardSteps.map((item) => (
                <li key={item.id} className={`${step === item.id ? "active" : ""} ${step > item.id || (workspace.status === "live" && !isDraftOnly) ? "done" : ""}`}>
                  <button
                    onClick={() => {
                      if (!accessToken && item.id > 1) {
                        setStep(1);
                        setSystemNotice("Create or sign in to a creator account before continuing.");
                        return;
                      }
                      setStep(item.id);
                    }}
                    aria-current={step === item.id ? "step" : undefined}
                  >
                    <span>{step > item.id ? "✓" : item.id}</span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>
          )}

          {viewMode === "dashboard" && (
            <div className="screen-stack">
              <header className="page-header">
                <div>
                  <h1>
                    {dashTab === "review" ? "Conversations" : dashTab === "channels" ? "Channels" : avatarTitle}
                  </h1>
                  <p>
                    {dashTab === "review"
                      ? "Sensitive or unclear fan messages, grouped by conversation, so you can see what was asked and how your avatar answered."
                      : dashTab === "channels"
                        ? "How fans can reach your avatar. Chat is live today; voice and video are on the way."
                        : (
                          <>
                            <span className={`status-pill ${statusTone}`}>{statusLabel}</span> @{cleanHandle(workspace.creatorHandle)}
                          </>
                        )}
                  </p>
                </div>
                <div className="page-header-actions">
                  <button className="secondary-action" onClick={() => editCurrentPersona(2)}>
                    Edit avatar
                  </button>
                  {workspace.status === "live" ? (
                    <button className="primary-action" onClick={() => void copyShareLink()}>
                      Copy fan link
                    </button>
                  ) : (
                    <button className="primary-action" onClick={() => void savePersona("live")} disabled={saving}>
                      Publish avatar
                    </button>
                  )}
                </div>
              </header>

              {dashTab === "overview" && (
                <>
                  <section className="loop-card" aria-label="Is your avatar working?">
                    <div className="loop-verdict">
                      <span className="section-kicker">Performance</span>
                      <h3>{loopVerdict.headline}</h3>
                      <p>{loopVerdict.detail}</p>
                    </div>
                    <ol className="loop-steps">
                      {loopSteps.map((item) => (
                        <li key={item.label} className={item.done ? "done" : ""}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <small>{item.note}</small>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section className="dashboard-grid">
                    <div className="product-card persona-management-card">
                      <span className="section-kicker">Public link</span>
                      <div className="share-url-box compact dashboard-link">
                        <span>Fan chat</span>
                        <strong>{shareUrl}</strong>
                      </div>
                      <div className="button-row compact-actions">
                        <Link className="secondary-action" href={publicPath}>
                          Open fan chat
                        </Link>
                        {workspace.status === "live" && (
                          <button className="secondary-action" onClick={() => void savePersona("paused")} disabled={saving}>
                            Pause
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="product-card persona-management-card">
                      <span className="section-kicker">Needs your attention</span>
                      <h3>
                        {reviewGroups.length
                          ? `${reviewGroups.length} ${reviewGroups.length === 1 ? "conversation" : "conversations"} to review`
                          : "Nothing to review"}
                      </h3>
                      <p>Private, risky, or unclear fan messages are held here for you.</p>
                      <button className="secondary-action" onClick={() => setDashTab("review")}>
                        Open conversations
                      </button>
                    </div>
                  </section>

                  <section className="product-card portfolio-card">
                    <div className="section-heading-row">
                      <div>
                        <span className="section-kicker">Your avatars</span>
                      </div>
                    </div>
                    <div className="persona-table">
                      {personaPortfolio.map((persona) => {
                        const metrics = persona.id ? metricsByPersona[persona.id] : undefined;
                        return (
                          <button
                            key={persona.id || persona.creator_handle}
                            className={cleanHandle(persona.creator_handle) === cleanHandle(workspace.creatorHandle) ? "active" : ""}
                            onClick={() => selectPersona(persona)}
                          >
                            <span>
                              <strong>{persona.creator_name || "Unnamed avatar"}</strong>
                              <small>@{cleanHandle(persona.creator_handle)}</small>
                            </span>
                            <em>{persona.status}</em>
                            <span>{metrics?.conversations || 0} chats</span>
                            <span>{metrics?.fanMessages || 0} messages</span>
                            <span>{metrics?.fallbackRate || 0}% stepped back</span>
                          </button>
                        );
                      })}
                      {!personaPortfolio.length && (
                        <div className="empty-state">
                          <strong>No avatars yet</strong>
                          <p>Create and publish your first avatar to see it here.</p>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}

              {dashTab === "review" && (
                <section className="product-card review-queue-card" id="needs-review">
                  <div className="review-list">
                    {reviewGroups.slice(0, 20).map((group) => (
                      <article key={group.key} className="review-thread">
                        <header>
                          <span>{group.personaName || "Avatar"}</span>
                          <em>{group.reason}</em>
                        </header>
                        {group.items.map((item) => (
                          <p key={item.id} className={item.role === "fan" ? "from-fan" : "from-persona"}>
                            <small>{item.role === "fan" ? "Fan asked" : "Avatar replied"}</small>
                            {item.text}
                          </p>
                        ))}
                      </article>
                    ))}
                    {!reviewGroups.length && (
                      <div className="empty-state">
                        <strong>No conversations need review</strong>
                        <p>Private, risky, or unclear fan messages will appear here.</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {dashTab === "channels" && (
                <section className="channel-grid" aria-label="Channels">
                  <article className="channel-card live">
                    <header>
                      <h3>Chat</h3>
                      <span className="status-pill live">Live</span>
                    </header>
                    <p>Fans message your avatar from one link. Replies come from your approved content and respect your boundaries.</p>
                    <div className="share-url-box compact">
                      <span>Fan link</span>
                      <strong>{shareUrl}</strong>
                    </div>
                    <div className="button-row compact-actions">
                      <button className="secondary-action" onClick={() => void copyShareLink()}>
                        Copy link
                      </button>
                      <Link className="secondary-action" href={publicPath}>
                        Open chat
                      </Link>
                    </div>
                  </article>
                  <article className="channel-card">
                    <header>
                      <h3>Voice</h3>
                      <span className="status-pill soon">Coming soon</span>
                    </header>
                    <p>Fans talk to your avatar out loud. Voice will only ever use your voice with your explicit consent.</p>
                  </article>
                  <article className="channel-card">
                    <header>
                      <h3>Video calls</h3>
                      <span className="status-pill soon">Coming soon</span>
                    </header>
                    <p>Face-to-face conversations with a video avatar, under the same approvals and boundaries as chat.</p>
                  </article>
                </section>
              )}
            </div>
          )}

          {viewMode === "onboarding" && step === 1 && (
            <div className="product-card account-card">
              <span className="section-kicker">Step 1 of 5</span>
              <div className="account-heading">
                <h2>
                  {accessToken
                    ? creatingNewPersona
                      ? "Start a new persona"
                      : hasSavedPersona
                        ? "You're signed in"
                        : "You're signed in. Let's build your persona"
                    : authMode === "signup"
                      ? "Create your account"
                      : "Log in to continue"}
                </h2>
                <p>
                  {accessToken
                    ? creatingNewPersona
                      ? "Next, add the public material this persona will speak from."
                      : hasSavedPersona
                        ? "Continue editing your saved persona, or start a new one from the dashboard."
                        : "Next, add the public material your AI will learn from."
                    : authMode === "signup"
                      ? "One account lets you create personas, edit them later, and see fan conversations."
                      : "Log in to return to your personas, check performance, or keep editing."}
                </p>
              </div>

              <div className="account-layout login-only">
                <section className="account-panel">
                  {!accessToken && (
                    <div className="auth-switch" aria-label="Account mode">
                      <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
                        Sign up
                      </button>
                      <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>
                        Log in
                      </button>
                    </div>
                  )}

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

              {accessToken && hasSavedPersona && !creatingNewPersona && (
                <section className="returning-dashboard">
                  <div>
                    <span className="section-kicker">Saved persona</span>
                    <h3>{workspace.creatorName}</h3>
                    <p>
                      {workspace.status === "live"
                        ? "Your fan link is live."
                        : workspace.status === "paused"
                          ? "Paused. Publish again to reopen your fan link."
                          : "Saved as a draft. Publish to get your fan link."}
                    </p>
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

              {systemNotice && <div className="inline-action-notice" role="status">{systemNotice}</div>}

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
                    : "Continue to public material"}
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
              <span className="section-kicker">Step 2 of 5</span>
              <h2>Add what fans already see from you</h2>
              <p>Paste captions, transcripts, or FAQs. Fanline drafts your voice, topics, and welcome message. You review everything before it goes live.</p>

              <div className="creator-setup-grid">
                <section className="profile-panel">
                  <h3 className="form-section-title">{creatingNewPersona ? "Who is this persona for?" : "Creator details"}</h3>
                  <div className="account-fields">
                    <label>
                      Creator name
                      <input
                        id="field-creatorName"
                        value={workspace.creatorName}
                        onChange={(event) => {
                          const name = event.target.value;
                          const previousSuggestion = workspace.creatorName.trim() ? `@${suggestHandle(workspace.creatorName)}` : "";
                          setWorkspace((current) => ({
                            ...current,
                            creatorName: name,
                            creatorHandle:
                              !current.creatorHandle.trim() || current.creatorHandle === previousSuggestion
                                ? name.trim()
                                  ? `@${suggestHandle(name)}`
                                  : ""
                                : current.creatorHandle,
                          }));
                        }}
                        placeholder="e.g. Priya Sharma"
                        aria-invalid={showStep2Errors && Boolean(step2Errors.creatorName)}
                        aria-describedby={showStep2Errors && step2Errors.creatorName ? "error-creatorName" : undefined}
                      />
                      {showStep2Errors && step2Errors.creatorName && (
                        <span className="field-error" id="error-creatorName">{step2Errors.creatorName}</span>
                      )}
                    </label>
                    <label>
                      Public handle
                      <input
                        id="field-creatorHandle"
                        value={workspace.creatorHandle}
                        onChange={(event) => updateField("creatorHandle", event.target.value)}
                        placeholder="e.g. @priya"
                        aria-invalid={showStep2Errors && Boolean(step2Errors.creatorHandle)}
                        aria-describedby={showStep2Errors && step2Errors.creatorHandle ? "error-creatorHandle" : undefined}
                      />
                      {showStep2Errors && step2Errors.creatorHandle && (
                        <span className="field-error" id="error-creatorHandle">{step2Errors.creatorHandle}</span>
                      )}
                    </label>
                  </div>
                  <p className="field-hint">Your fan link will be {(origin || "").replace(/^https?:\/\//, "")}/p/{cleanHandle(workspace.creatorHandle || "your-handle")}. Letters and numbers only.</p>
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
                  <h3>Paste captions, transcripts, posts, or FAQs</h3>
                  <p>Only include things you are happy to be represented by. The more specific it is, the better fans&apos; answers will sound like you.</p>
                </div>
                <div className="material-input">
                <textarea
                  value={workspace.content}
                  onChange={(event) => updateField("content", event.target.value)}
                  id="field-content"
                  aria-label="Creator public material"
                  aria-invalid={showStep2Errors && Boolean(step2Errors.content)}
                  aria-describedby={showStep2Errors && step2Errors.content ? "error-content" : undefined}
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
                {showStep2Errors && step2Errors.content && (
                  <p className="field-error" id="error-content">{step2Errors.content}</p>
                )}
                <div className="material-helper">
                  <span>{workspace.content.trim().length} characters. Aim for 500 or more.</span>
                  {!workspace.content.trim() && (
                    <button type="button" className="secondary-action" onClick={() => updateField("content", sampleMaterial)}>
                      Try with sample material
                    </button>
                  )}
                </div>
                </div>
              </section>

              <section className="source-builder language-builder">
                <div>
                  <span className="section-kicker">Languages</span>
                  <h3>Which languages should your AI reply in?</h3>
                  <p>English is on by default. Add others only if you really chat that way. &quot;Hinglish&quot; means Hindi and English mixed.</p>
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
                  <h3>Add 3-5 replies that sound exactly like you</h3>
                  <p>Optional, but it is the fastest way to get your tone right.</p>
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
              <div className={`consent-panel ${showStep2Errors && step2Errors.consent ? "invalid" : ""}`}>
                <label className="consent-row">
                  <input
                    id="field-consent"
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(event) => setConsentGiven(event.target.checked)}
                    aria-describedby="consent-help"
                  />
                  <span>{consentText}</span>
                </label>
                <p id="consent-help" className="field-hint">
                  Required before anything is drafted, saved, or published. You can pause your AI at any time.
                </p>
              </div>
              {showStep2Errors && step2ErrorList.length > 0 && (
                <div className="error-summary" role="alert">
                  <strong>Finish these before we draft your AI voice</strong>
                  <ul>
                    {step2ErrorList.map(([key, message]) => (
                      <li key={key}>
                        <a href={`#field-${key}`}>{message}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="button-row">
                <button className="secondary-action" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  className="primary-action"
                  onClick={() => {
                    if (step2ErrorList.length) {
                      setShowStep2Errors(true);
                      const firstId = `field-${step2ErrorList[0][0]}`;
                      requestAnimationFrame(() => {
                        const el = document.getElementById(firstId);
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                        el?.focus({ preventScroll: true });
                      });
                      return;
                    }
                    setDrafting(true);
                    void generateProfile().finally(() => {
                      setDrafting(false);
                      setStep(3);
                    });
                  }}
                  disabled={drafting}
                >
                  {drafting ? "Drafting your voice…" : "Draft my AI voice"}
                </button>
              </div>
            </div>
          )}

          {viewMode === "onboarding" && step === 3 && (
            <div className="screen-stack">
              <div className="product-card">
                <span className="section-kicker">Step 3 of 5</span>
                <h2>Review your AI voice</h2>
                <p>Fanline drafted this from your content. Edit anything that does not sound like you. Nothing is public yet.</p>
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
                            ×
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
                  Looks right, continue
                </button>
              </div>
            </div>
          )}

          {viewMode === "onboarding" && step === 4 && (
            <div className="product-card">
              <span className="section-kicker">Step 4 of 5</span>
              <h2>Set your boundaries</h2>
              <p>Choose what your AI should never answer for you. When a fan asks, it politely steps back instead of guessing.</p>
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
              <div className="button-row">
                <button className="secondary-action" onClick={() => setStep(3)}>
                  Back
                </button>
                <button className="primary-action" onClick={() => setStep(5)}>
                  Continue to launch
                </button>
              </div>
            </div>
          )}

          {viewMode === "onboarding" && step === 5 && (
            <div className="screen-stack">
              <div className="launch-card">
                <span className="section-kicker">Step 5 of 5</span>
                <h2>{workspace.status === "live" ? "You're live. Share your fan link" : "Ready to go live?"}</h2>
                <p>
                  {workspace.status === "live"
                    ? "Put it in your Instagram bio, stories, Linktree, or broadcast channel. You can pause it any time."
                    : "Publishing makes your fan chat public. You can pause it any time, and you will see anything sensitive in your review queue."}
                </p>
                <div className="share-url-box">
                  <span>Your fan link</span>
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
                {workspace.status !== "live" &&
                  (consentGiven ? (
                    <p className="consent-confirmed">
                      ✓ Consent confirmed. You are this creator (or have their written permission), and fans will always see this is an AI.
                    </p>
                  ) : (
                    <div className={`consent-panel ${showConsentError ? "invalid" : ""}`}>
                      <label className="consent-row">
                        <input type="checkbox" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} />
                        <span>{consentText}</span>
                      </label>
                      {showConsentError && <p className="field-error">Consent is required before anything can go live.</p>}
                    </div>
                  ))}
                <div className="button-row">
                  {workspace.status !== "live" && (
                    <button className="secondary-action" onClick={() => setStep(4)}>
                      Back
                    </button>
                  )}
                  {workspace.status !== "live" && (
                    <button className="primary-action" onClick={publish} disabled={saving || !canPublish || !consentGiven}>
                      {saving ? "Publishing…" : "Publish my fan link"}
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
                      <button className="secondary-action" onClick={() => setViewMode("dashboard")}>
                        Go to dashboard
                      </button>
                      <button className="secondary-action" onClick={() => void savePersona("paused")} disabled={saving}>
                        Pause
                      </button>
                    </>
                  )}
                </div>
              </div>

              <section className="analytics-grid" hidden={isDraftOnly || workspace.status !== "live"}>
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
        </main>
      </div>
    </div>
  );
}
