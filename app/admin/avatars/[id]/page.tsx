"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { guardrails } from "../../../persona-model";
import { LiveAvatarSandbox } from "../../../../components/live-avatar-sandbox";
import { AdminGate, adminFetch, type Role } from "../../admin-client";

type Profile = {
  topics: string[];
  phrases: string[];
  tone: string[];
  supportedLanguages: string[];
  bio: string;
  fanRelationship: string;
  responseStyle: string;
  greetingStyle: string;
  exampleReplies: string[];
  neverSay: string[];
};

type Avatar = {
  id: string;
  creator_name: string;
  creator_handle: string;
  source_content: string;
  profile: Profile;
  enabled_guardrails: Record<string, boolean>;
  custom_boundary: string;
  fallback_text: string;
  status: "draft" | "live" | "paused";
  approval_status: "none" | "pending" | "approved" | "changes_requested";
  approved_by_email: string | null;
  approved_at: string | null;
  claim_email: string | null;
  internal_notes: string;
  is_example?: boolean;
  active_variant_id?: string | null;
  rights_confirmed_by_email?: string | null;
  rights_confirmed_at?: string | null;
  rights_reference?: string | null;
  territories?: string[] | null;
  voice_config?: { enabled?: boolean; voice?: string; instructions?: string; realtime_enabled?: boolean; realtime_voice?: string };
  video_config?: { enabled?: boolean; replica_id?: string; consent_verified?: boolean; notes?: string };
};

type Activity = { id: string; action: string; actor_email: string; details: Record<string, unknown>; created_at: string };

const tabs = ["Overview", "Rights", "Content", "Voice and limits", "Variants", "Voice", "Video", "Test chat", "Approval", "Activity"] as const;
type Tab = (typeof tabs)[number];


const languageOptions = ["English", "Hindi", "Hinglish", "Tamil", "Telugu", "Kannada", "Bengali", "Marathi", "Gujarati", "Malayalam", "Punjabi"];
const toneOptions = ["Warm", "Playful", "Direct", "Professional"];
const lengthOptions = ["Short", "Medium"];
const emojiOptions = ["None", "Some", "Lots"];
const fallbackPresets = [
  "I cannot speak to that one. It is outside the boundaries this AI avatar is approved to discuss, so please check the creator's official channels.",
  "That one is best answered by me directly. Please check my official channels for the latest.",
  "I will leave that one alone. Ask me about my work or what I am up to instead.",
];

function composeStyle(tone: string, length: string, emoji: string) {
  const toneText: Record<string, string> = {
    Warm: "Warm, friendly and encouraging.",
    Playful: "Playful, light and a little cheeky.",
    Direct: "Direct, practical and to the point.",
    Professional: "Polished, professional and measured.",
  };
  const lengthText = length === "Short" ? "Keep replies to one to three sentences." : "Replies can run a short paragraph or two.";
  const emojiText = emoji === "None" ? "Do not use emoji." : emoji === "Some" ? "Use an occasional emoji." : "Use emoji freely.";
  return `${toneText[tone]} ${lengthText} ${emojiText}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Workspace({ role }: { role: Role }) {
  const { id } = useParams<{ id: string }>();
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [videoStatus, setVideoStatus] = useState({ providerConfigured: false, brainConfigured: false });
  const [tab, setTab] = useState<Tab>("Overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await adminFetch(`/api/admin/avatars/${id}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not load this avatar");
      return;
    }
    setError("");
    setAvatar(data.avatar);
    setActivity(data.activity);
    if (data.video) setVideoStatus(data.video);
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function call(label: string, path: string, init: RequestInit, success: string) {
    setBusy(label);
    setError("");
    setNotice("");
    const response = await adminFetch(path, init);
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setError(data.error || "That did not work");
      return null;
    }
    setNotice(data.approval_reset ? `${success} Approval was reset because the avatar changed, so it needs approving again.` : success);
    await load();
    return data;
  }

  if (error && !avatar) return <div className="system-notice" role="alert">{error}</div>;
  if (!avatar) return <p>Loading…</p>;

  const hasRights = Boolean(avatar.rights_confirmed_at);
  // A brand-new avatar already has a default profile, so look for an explicit draft or voice save.
  const drafted = activity.some(
    (entry) =>
      entry.action === "profile_drafted" ||
      (entry.action === "avatar_updated" &&
        Array.isArray(entry.details.fields) &&
        (entry.details.fields as string[]).includes("profile") &&
        !(entry.details.fields as string[]).includes("source_content")),
  );
  const checklist = [
    { label: "Rights confirmed", done: hasRights },
    { label: "Content added (200+ characters)", done: avatar.source_content.trim().length >= 200 },
    { label: "Voice and topics drafted or edited", done: drafted },
    { label: "Submitted for approval", done: avatar.approval_status === "pending" || avatar.approval_status === "approved" },
    { label: "Approved by an admin", done: avatar.approval_status === "approved" },
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <p className="admin-crumb">
            <Link href="/admin">Avatars</Link> / {avatar.creator_name}
          </p>
          <h1>{avatar.creator_name}</h1>
          <p>
            <span className={`status-pill ${avatar.status === "live" ? "live" : avatar.status === "paused" ? "paused" : "draft"}`}>{avatar.status}</span> @{avatar.creator_handle}
            {avatar.is_example && <span className="status-pill soon">Example</span>}
          </p>
        </div>
        <div className="page-header-actions">
          {avatar.status === "live" && (
            <button className="secondary-action" disabled={busy === "pause"} onClick={() => void call("pause", `/api/admin/avatars/${id}/status`, { method: "POST", body: JSON.stringify({ status: "paused" }) }, "Avatar paused.")}>
              Pause now
            </button>
          )}
          {avatar.status === "live" && (
            <Link className="secondary-action" href={`/p/${avatar.creator_handle}`} target="_blank">
              Open public chat
            </Link>
          )}
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Avatar sections">
        {tabs.map((name) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            aria-current={tab === name ? "page" : undefined}
            onClick={() => {
              setTab(name);
              setNotice("");
              setError("");
            }}
          >
            {name}
          </button>
        ))}
      </nav>

      {avatar.is_example && (
        <div className="system-notice" role="note">
          Example avatar for practice. It is not affiliated with or endorsed by the person named, and it can never be published.
        </div>
      )}
      {error && <div className="system-notice" role="alert">{error}</div>}
      {notice && <div className="success-notice" role="status">{notice}</div>}

      {tab === "Overview" && (
        <OverviewTab avatar={avatar} checklist={checklist} busy={busy} onSave={(notes) => call("notes", `/api/admin/avatars/${id}`, { method: "PATCH", body: JSON.stringify(notes) }, "Saved.")} />
      )}
      {tab === "Rights" && <RightsTab id={id} role={role} avatar={avatar} busy={busy} call={call} />}
      {tab === "Content" && <ContentTab id={id} avatar={avatar} hasAgreement={hasRights} busy={busy} call={call} />}
      {tab === "Voice and limits" && <VoiceTab id={id} avatar={avatar} busy={busy} call={call} />}
      {tab === "Variants" && <VariantsTab id={id} avatar={avatar} role={role} busy={busy} call={call} setError={setError} reload={load} />}
      {tab === "Voice" && <VoiceRepliesTab id={id} avatar={avatar} busy={busy} call={call} setError={setError} />}
      {tab === "Video" && <VideoTab id={id} avatar={avatar} status={videoStatus} busy={busy} call={call} />}
      {tab === "Test chat" && <TestChat id={id} avatar={avatar} />}
      {tab === "Approval" && <ApprovalTab id={id} role={role} avatar={avatar} checklist={checklist} activity={activity} busy={busy} call={call} />}
      {tab === "Activity" && <ActivityTab activity={activity} />}
    </>
  );
}

type Call = (label: string, path: string, init: RequestInit, success: string) => Promise<Record<string, unknown> | null>;

function OverviewTab({ avatar, checklist, busy, onSave }: { avatar: Avatar; checklist: { label: string; done: boolean }[]; busy: string; onSave: (body: Record<string, string>) => Promise<unknown> }) {
  const [notes, setNotes] = useState(avatar.internal_notes);
  const [claim, setClaim] = useState(avatar.claim_email || "");
  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Go-live checklist</h2>
        <ul className="admin-checklist">
          {checklist.map((item) => (
            <li key={item.label} className={item.done ? "done" : ""}>
              <span aria-hidden="true">{item.done ? "✓" : ""}</span>
              {item.label}
            </li>
          ))}
        </ul>
      </section>
      <section className="product-card">
        <h2>Internal details</h2>
        <div className="field-grid">
          <label>
            Creator&apos;s email (for claiming this avatar later)
            <input type="email" value={claim} onChange={(event) => setClaim(event.target.value)} />
          </label>
          <label>
            Internal notes (never shown to fans)
            <textarea className="compact-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
        <div className="button-row">
          <button className="secondary-action" disabled={busy === "notes"} onClick={() => void onSave({ internal_notes: notes, claim_email: claim })}>
            Save details
          </button>
        </div>
      </section>
    </div>
  );
}

function RightsTab({ id, role, avatar, busy, call }: { id: string; role: Role; avatar: Avatar; busy: string; call: Call }) {
  const confirmed = Boolean(avatar.rights_confirmed_at);
  const [confirm, setConfirm] = useState(confirmed);
  const [reference, setReference] = useState(avatar.rights_reference || "");
  const [territories, setTerritories] = useState<Record<string, boolean>>(() => {
    const current = avatar.territories && avatar.territories.length ? avatar.territories : ["IN", "US"];
    return { IN: current.includes("IN"), US: current.includes("US"), ROW: current.includes("ROW") };
  });
  const selected = Object.keys(territories).filter((key) => territories[key]);
  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Rights</h2>
        <p className="field-hint">
          The signed agreement with the creator is handled outside this tool. Here, record that someone on the team confirmed it, with a one-line pointer to where it is kept, and where the avatar may be used.
        </p>
        {confirmed && (
          <p>
            <span className="status-pill live">Rights confirmed</span> by {avatar.rights_confirmed_by_email} on {avatar.rights_confirmed_at ? new Date(avatar.rights_confirmed_at).toLocaleDateString() : ""}.
          </p>
        )}
        <label className="consent-row live-call-consent">
          <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
          <span>I confirm a signed agreement with this creator or celebrity (or their authorised representative) exists, and it covers this avatar.</span>
        </label>
        <div className="field-grid">
          <label>
            One-line reference
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. Agreement signed 12 Oct, kept in Drive / Legal" />
          </label>
        </div>
        <div className="choice-group">
          <span className="choice-label">Where this avatar may be used</span>
          <div className="choice-row">
            {[
              ["IN", "India"],
              ["US", "United States"],
              ["ROW", "Rest of world"],
            ].map(([code, label]) => (
              <button key={code} type="button" className="choice" aria-pressed={territories[code]} onClick={() => setTerritories({ ...territories, [code]: !territories[code] })}>
                {label}
              </button>
            ))}
          </div>
          <span className="field-hint">Fans outside these regions can&apos;t use this avatar.</span>
        </div>
        <div className="button-row">
          <button
            className="primary-action"
            disabled={busy === "rights" || !confirm || reference.trim().length < 5 || !selected.length}
            onClick={() => void call("rights", `/api/admin/avatars/${id}/rights`, { method: "POST", body: JSON.stringify({ confirm: true, reference, territories: selected }) }, confirmed ? "Rights details updated." : "Rights confirmed.")}
          >
            {confirmed ? "Update" : "Confirm rights"}
          </button>
          {role === "admin" && confirmed && (
            <button
              className="secondary-action danger"
              disabled={busy === "withdraw"}
              onClick={() => void call("withdraw", `/api/admin/avatars/${id}/rights`, { method: "DELETE" }, "Rights withdrawn. The avatar is paused and approval was cleared.")}
            >
              Withdraw rights
            </button>
          )}
        </div>
        {role === "admin" && confirmed && <p className="field-hint">Withdrawing pauses the avatar right away, ends live calls and clears approval.</p>}
      </section>
    </div>
  );
}

function ContentTab({ id, avatar, hasAgreement, busy, call }: { id: string; avatar: Avatar; hasAgreement: boolean; busy: string; call: Call }) {
  const [content, setContent] = useState(avatar.source_content);

  type FileStatus = { name: string; state: "uploading" | "reading" | "done" | "error"; note: string };
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [fileKey, setFileKey] = useState(0);

  function setStatus(name: string, patch: Partial<FileStatus>) {
    setFileStatuses((current) => current.map((item) => (item.name === name ? { ...item, ...patch } : item)));
  }

  // Uploads each file straight to storage, then asks the server to read it (PDF text or audio transcript).
  async function addFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const list = Array.from(files);
    setFileStatuses(list.map((file) => ({ name: file.name, state: "uploading", note: "Uploading…" })));
    for (const file of list) {
      try {
        const urlResponse = await adminFetch(`/api/admin/avatars/${id}/ingest/upload-url`, { method: "POST", body: JSON.stringify({ name: file.name, size: file.size }) });
        const urlData = await urlResponse.json();
        if (!urlResponse.ok) throw new Error(urlData.error || "Could not start the upload");

        const put = await fetch(urlData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!put.ok) throw new Error("The upload failed");

        const isAudio = /\.(mp3|m4a|wav|webm|mp4|mpeg|mpga|ogg|oga|flac)$/i.test(file.name);
        setStatus(file.name, { state: "reading", note: isAudio ? "Transcribing the audio. This can take a minute…" : "Reading the file…" });
        const readResponse = await adminFetch(`/api/admin/avatars/${id}/ingest`, { method: "POST", body: JSON.stringify({ path: urlData.path, name: file.name }) });
        const readData = await readResponse.json();
        if (!readResponse.ok) throw new Error(readData.error || "Could not read the file");

        if (readData.text) setContent((current) => [current.trim(), `# ${file.name}\n${readData.text}`].filter(Boolean).join("\n\n"));
        const warning = (readData.warnings || []).join(" ");
        setStatus(file.name, { state: warning ? "error" : "done", note: warning || `Added ${Number(readData.chars).toLocaleString()} characters. Review, then save.` });
      } catch (failure) {
        setStatus(file.name, { state: "error", note: failure instanceof Error ? failure.message : "Something went wrong" });
      }
    }
    setFileKey((key) => key + 1);
  }

  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Training content</h2>
        <p className="field-hint">Everything the creator has approved for their avatar to draw on: captions, transcripts, interviews, FAQs, press kits. Add PDFs, audio or video recordings (we transcribe them, including Hindi and other Indian languages), or text files. Files can be up to 25 MB each.</p>
        <textarea className="admin-content" value={content} onChange={(event) => setContent(event.target.value)} aria-label="Training content" />
        <div className="material-helper">
          <span>{content.trim().length.toLocaleString()} characters</span>
          <input key={fileKey} type="file" multiple accept=".pdf,.mp3,.m4a,.wav,.webm,.mp4,.mpeg,.ogg,.flac,.txt,.md,.srt,.vtt,.csv,.json" onChange={(event) => void addFiles(event.target.files)} aria-label="Add PDF, audio or text files" disabled={!hasAgreement} />
        </div>
        {!hasAgreement && <p className="field-hint">Adding files unlocks once rights are confirmed (Rights tab).</p>}
        {fileStatuses.length > 0 && (
          <ul className="ingest-list" aria-live="polite">
            {fileStatuses.map((item) => (
              <li key={item.name} className={item.state}>
                <strong>{item.name}</strong>
                <span>{item.note}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="button-row">
          <button className="secondary-action" disabled={busy === "content" || content === avatar.source_content} onClick={() => void call("content", `/api/admin/avatars/${id}`, { method: "PATCH", body: JSON.stringify({ source_content: content }) }, "Content saved.")}>
            Save content
          </button>
          <button
            className="primary-action"
            disabled={busy === "draft" || !hasAgreement || content !== avatar.source_content}
            title={!hasAgreement ? "Confirm rights first (Rights tab)" : content !== avatar.source_content ? "Save the content first" : ""}
            onClick={() => void call("draft", `/api/admin/avatars/${id}/draft`, { method: "POST" }, "Voice and topics drafted from the content.")}
          >
            {busy === "draft" ? "Drafting…" : "Draft voice and topics"}
          </button>
        </div>
        {!hasAgreement && <p className="field-error">Training is locked until rights are confirmed (Rights tab).</p>}
      </section>
    </div>
  );
}

function VoiceTab({ id, avatar, busy, call }: { id: string; avatar: Avatar; busy: string; call: Call }) {
  const [profile, setProfile] = useState<Profile>(avatar.profile);
  const [rails, setRails] = useState<Record<string, boolean>>(avatar.enabled_guardrails || {});
  const [fallback, setFallback] = useState(avatar.fallback_text);
  const [custom, setCustom] = useState(avatar.custom_boundary);
  const [tone, setTone] = useState("Warm");
  const [length, setLength] = useState("Short");
  const [emoji, setEmoji] = useState("Some");
  const [styleTouched, setStyleTouched] = useState(false);

  function setStyle(next: { tone?: string; length?: string; emoji?: string }) {
    const t = next.tone ?? tone;
    const l = next.length ?? length;
    const e = next.emoji ?? emoji;
    setTone(t);
    setLength(l);
    setEmoji(e);
    setStyleTouched(true);
    setProfile((current) => ({ ...current, tone: [t.toLowerCase()], responseStyle: composeStyle(t, l, e) }));
  }

  function toggleLanguage(language: string) {
    setProfile((current) => {
      const has = current.supportedLanguages.some((item) => item.toLowerCase() === language.toLowerCase());
      return {
        ...current,
        supportedLanguages: has ? current.supportedLanguages.filter((item) => item.toLowerCase() !== language.toLowerCase()) : [...current.supportedLanguages, language],
      };
    });
  }

  const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Voice</h2>
        <div className="field-grid">
          <label>
            Bio
            <textarea className="compact-textarea" value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} />
          </label>
          <label>
            First message fans see
            <textarea className="compact-textarea" value={profile.greetingStyle} onChange={(event) => setProfile({ ...profile, greetingStyle: event.target.value })} />
          </label>
          <label>
            Why fans come to them
            <textarea className="compact-textarea" value={profile.fanRelationship} onChange={(event) => setProfile({ ...profile, fanRelationship: event.target.value })} />
          </label>
          <label>
            Topics they are known for (one per line)
            <textarea className="compact-textarea" value={profile.topics.join("\n")} onChange={(event) => setProfile({ ...profile, topics: lines(event.target.value) })} />
          </label>
        </div>
        <div className="choice-group">
          <span className="choice-label">Languages</span>
          <div className="choice-row">
            {languageOptions.map((language) => (
              <button key={language} type="button" className="choice" aria-pressed={profile.supportedLanguages.some((item) => item.toLowerCase() === language.toLowerCase())} onClick={() => toggleLanguage(language)}>
                {language}
              </button>
            ))}
          </div>
        </div>
        {(["Tone", "Reply length", "Emoji"] as const).map((label) => {
          const options = label === "Tone" ? toneOptions : label === "Reply length" ? lengthOptions : emojiOptions;
          const value = label === "Tone" ? tone : label === "Reply length" ? length : emoji;
          return (
            <div className="choice-group" key={label}>
              <span className="choice-label">{label}</span>
              <div className="choice-row">
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="choice"
                    aria-pressed={styleTouched && value === option}
                    onClick={() => setStyle(label === "Tone" ? { tone: option } : label === "Reply length" ? { length: option } : { emoji: option })}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="field-hint">Current style: {profile.responseStyle || "not set"}</p>
        <label className="admin-block">
          Example replies, in the creator&apos;s voice (one per line, format: Question: … Answer: …)
          <textarea className="compact-textarea" value={profile.exampleReplies.join("\n")} onChange={(event) => setProfile({ ...profile, exampleReplies: lines(event.target.value) })} />
        </label>
      </section>

      <section className="product-card">
        <h2>Limits</h2>
        <p className="field-hint always-on">Always on: never pretends to be the real person, and never gives medical, financial or legal advice.</p>
        <div className="choice-group">
          <span className="choice-label">Also avoid</span>
          <div className="choice-row">
            {guardrails
              .filter((rail) => !rail.locked)
              .map((rail) => (
                <button key={rail.key} type="button" className="choice" aria-pressed={Boolean(rails[rail.key])} title={rail.description} onClick={() => setRails({ ...rails, [rail.key]: !rails[rail.key] })}>
                  {rail.title}
                </button>
              ))}
          </div>
        </div>
        <div className="field-grid">
          <label>
            Other off-limits topics (comma separated)
            <input value={custom} onChange={(event) => setCustom(event.target.value)} />
          </label>
          <label>
            When it cannot answer
            <select value={fallbackPresets.includes(fallback) ? fallback : "custom"} onChange={(event) => event.target.value !== "custom" && setFallback(event.target.value)}>
              {!fallbackPresets.includes(fallback) && <option value="custom">Custom message</option>}
              {fallbackPresets.map((preset) => (
                <option key={preset} value={preset}>
                  {preset.slice(0, 60)}…
                </option>
              ))}
            </select>
          </label>
          <label>
            Never say (one phrase per line)
            <textarea className="compact-textarea" value={profile.neverSay.join("\n")} onChange={(event) => setProfile({ ...profile, neverSay: lines(event.target.value) })} />
          </label>
        </div>
        <div className="button-row">
          <button
            className="primary-action"
            disabled={busy === "voice"}
            onClick={() =>
              void call(
                "voice",
                `/api/admin/avatars/${id}`,
                { method: "PATCH", body: JSON.stringify({ profile, enabled_guardrails: rails, fallback_text: fallback, custom_boundary: custom }) },
                "Voice and limits saved.",
              )
            }
          >
            Save voice and limits
          </button>
        </div>
      </section>
    </div>
  );
}

type VariantRow = {
  id: string;
  name: string;
  genre: string;
  description: string;
  overlay: { styleNotes: string; extraInstructions: string; greeting: string; voiceInstructions: string; extraAvoid: string[]; extraNeverSay: string[] };
  approval_status: "none" | "pending" | "approved" | "changes_requested";
  approved_by_email: string | null;
};

type VariantTemplate = { genre: string; label: string; overlay: VariantRow["overlay"] };

const emptyOverlay = { styleNotes: "", extraInstructions: "", greeting: "", voiceInstructions: "", extraAvoid: [] as string[], extraNeverSay: [] as string[] };

function VariantsTab({ id, avatar, role, busy, call, setError, reload }: { id: string; avatar: Avatar; role: Role; busy: string; call: Call; setError: (value: string) => void; reload: () => Promise<void> }) {
  const [variants, setVariants] = useState<VariantRow[] | null>(null);
  const [templates, setTemplates] = useState<VariantTemplate[]>([]);
  const [activeId, setActiveId] = useState<string | null>(avatar.active_variant_id || null);
  const [editing, setEditing] = useState<string>("");
  const [form, setForm] = useState({ name: "", genre: "custom", description: "", overlay: emptyOverlay });
  const [signoffFor, setSignoffFor] = useState("");
  const [reference, setReference] = useState("");
  const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
  const commas = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

  const load = useCallback(async () => {
    const response = await adminFetch(`/api/admin/avatars/${id}/variants`);
    if (!response.ok) return;
    const data = await response.json();
    setVariants(data.variants);
    setTemplates(data.templates);
    setActiveId(data.active_variant_id);
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  function startNew(genre: string) {
    const template = templates.find((item) => item.genre === genre);
    setEditing("new");
    setForm({ name: template ? `${template.label} mode` : "", genre, description: "", overlay: template ? { ...template.overlay } : emptyOverlay });
  }

  function startEdit(row: VariantRow) {
    setEditing(row.id);
    setForm({ name: row.name, genre: row.genre, description: row.description, overlay: { ...emptyOverlay, ...row.overlay } });
  }

  async function save() {
    const path = editing === "new" ? `/api/admin/avatars/${id}/variants` : `/api/admin/avatars/${id}/variants/${editing}`;
    const result = await call("variant", path, { method: editing === "new" ? "POST" : "PATCH", body: JSON.stringify(form) }, editing === "new" ? "Mode created." : "Mode saved. It needs approving again.");
    if (result) {
      setEditing("");
      await load();
      await reload();
    }
  }

  async function act(row: VariantRow, path: string, init: RequestInit, success: string) {
    const result = await call(`variant-${row.id}`, path, init, success);
    if (result) {
      await load();
      await reload();
    }
  }

  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Genre modes</h2>
        <p className="field-hint">
          One main persona, plus adaptable modes such as Action or Horror. A mode can add a style and extra topics to avoid, but it can never switch off the main persona&apos;s limits. Each mode needs an admin's approval before fans can talk to it.
        </p>
        <p>
          Fans currently talk to: <strong>{activeId ? variants?.find((row) => row.id === activeId)?.name || "a mode" : "the main persona"}</strong>
        </p>
        {activeId && (
          <div className="button-row">
            <button className="secondary-action" disabled={busy === "variant-main"} onClick={() => void act({ id: "main" } as VariantRow, `/api/admin/avatars/${id}/variants/active`, { method: "POST", body: JSON.stringify({ variantId: null }) }, "Back to the main persona.")}>
              Switch back to the main persona
            </button>
          </div>
        )}
      </section>

      {variants === null ? (
        <p>Loading…</p>
      ) : (
        variants.map((row) => (
          <section key={row.id} className="product-card">
            <div className="section-heading-row">
              <div>
                <h3>
                  {row.name} <span className="status-pill soon">{row.genre}</span>{" "}
                  <span className={`status-pill ${row.approval_status === "approved" ? "live" : row.approval_status === "pending" ? "draft" : row.approval_status === "changes_requested" ? "paused" : "soon"}`}>
                    {{ none: "Not submitted", pending: "Awaiting approval", approved: "Approved", changes_requested: "Changes requested" }[row.approval_status]}
                  </span>{" "}
                  {activeId === row.id && <span className="status-pill live">Active for fans</span>}
                </h3>
                <p className="field-hint">{row.overlay.styleNotes || "No style notes yet."}</p>
              </div>
            </div>
            <div className="button-row">
              <button className="secondary-action" onClick={() => (editing === row.id ? setEditing("") : startEdit(row))}>
                {editing === row.id ? "Close" : "Edit"}
              </button>
              {(row.approval_status === "none" || row.approval_status === "changes_requested") && (
                <button className="secondary-action" disabled={busy === `variant-${row.id}`} onClick={() => void act(row, `/api/admin/avatars/${id}/variants/${row.id}/review`, { method: "POST", body: JSON.stringify({ decision: "submit" }) }, "Submitted for approval.")}>
                  Submit for approval
                </button>
              )}
              {role === "admin" && row.approval_status === "pending" && (
                <button className="primary-action" onClick={() => setSignoffFor(signoffFor === row.id ? "" : row.id)}>
                  Approve
                </button>
              )}
              {role === "admin" && row.approval_status === "approved" && activeId !== row.id && (
                <button className="primary-action" disabled={busy === `variant-${row.id}`} onClick={() => void act(row, `/api/admin/avatars/${id}/variants/active`, { method: "POST", body: JSON.stringify({ variantId: row.id }) }, `${row.name} is now active for fans.`)}>
                  Make active for fans
                </button>
              )}
              {role === "admin" && (
                <button className="secondary-action danger" disabled={busy === `variant-${row.id}`} onClick={() => void act(row, `/api/admin/avatars/${id}/variants/${row.id}`, { method: "DELETE" }, "Mode archived.")}>
                  Archive
                </button>
              )}
            </div>

            {signoffFor === row.id && (
              <div className="admin-form">
                <div className="field-grid">
                  <label>
                    Approval reference (optional)
                    <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. approved on WhatsApp, 12 Oct" />
                  </label>
                </div>
                <div className="button-row">
                  <button
                    className="primary-action"
                    onClick={async () => {
                      await act(row, `/api/admin/avatars/${id}/variants/${row.id}/review`, { method: "POST", body: JSON.stringify({ decision: "approve", reference }) }, "Mode approved.");
                      setSignoffFor("");
                      setReference("");
                    }}
                  >
                    Approve this mode
                  </button>
                </div>
              </div>
            )}

            {editing === row.id && <VariantForm form={form} setForm={setForm} lines={lines} commas={commas} onSave={() => void save()} saving={busy === "variant"} />}
          </section>
        ))
      )}

      <section className="product-card">
        <h3 className="form-section-title">Add a mode</h3>
        <div className="choice-row">
          {templates.map((template) => (
            <button key={template.genre} type="button" className="choice" onClick={() => startNew(template.genre)}>
              {template.label}
            </button>
          ))}
        </div>
        {editing === "new" && <VariantForm form={form} setForm={setForm} lines={lines} commas={commas} onSave={() => void save()} saving={busy === "variant"} />}
      </section>
    </div>
  );
}

function VariantForm({ form, setForm, lines, commas, onSave, saving }: {
  form: { name: string; genre: string; description: string; overlay: VariantRow["overlay"] };
  setForm: (value: { name: string; genre: string; description: string; overlay: VariantRow["overlay"] }) => void;
  lines: (value: string) => string[];
  commas: (value: string) => string[];
  onSave: () => void;
  saving: boolean;
}) {
  const setOverlay = (patch: Partial<VariantRow["overlay"]>) => setForm({ ...form, overlay: { ...form.overlay, ...patch } });
  return (
    <div className="admin-form">
      <div className="field-grid">
        <label>
          Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>
          How this mode should sound and behave
          <textarea className="compact-textarea" value={form.overlay.styleNotes} onChange={(event) => setOverlay({ styleNotes: event.target.value })} />
        </label>
        <label>
          Extra instructions (optional)
          <textarea className="compact-textarea" value={form.overlay.extraInstructions} onChange={(event) => setOverlay({ extraInstructions: event.target.value })} />
        </label>
        <label>
          Opening line for this mode (optional)
          <textarea className="compact-textarea" value={form.overlay.greeting} onChange={(event) => setOverlay({ greeting: event.target.value })} />
        </label>
        <label>
          Voice delivery (optional)
          <input value={form.overlay.voiceInstructions} onChange={(event) => setOverlay({ voiceInstructions: event.target.value })} />
        </label>
        <label>
          Extra topics to avoid (comma separated)
          <input value={form.overlay.extraAvoid.join(", ")} onChange={(event) => setOverlay({ extraAvoid: commas(event.target.value) })} />
        </label>
        <label>
          Extra things never to say (one per line)
          <textarea className="compact-textarea" value={form.overlay.extraNeverSay.join("\n")} onChange={(event) => setOverlay({ extraNeverSay: lines(event.target.value) })} />
        </label>
      </div>
      <div className="button-row">
        <button className="primary-action" disabled={saving || !form.name.trim() || !form.overlay.styleNotes.trim()} onClick={onSave}>
          Save mode
        </button>
      </div>
    </div>
  );
}

function VideoTab({ id, avatar, status, busy, call }: { id: string; avatar: Avatar; status: { providerConfigured: boolean; brainConfigured: boolean }; busy: string; call: Call }) {
  const [enabled, setEnabled] = useState(Boolean(avatar.video_config?.enabled));
  const [replicaId, setReplicaId] = useState(avatar.video_config?.replica_id || "");
  const [consent, setConsent] = useState(Boolean(avatar.video_config?.consent_verified));
  const [notes, setNotes] = useState(avatar.video_config?.notes || "");
  const [liveAvatar, setLiveAvatar] = useState<{ connected: boolean; credits?: number; error?: string } | null>(null);
  useEffect(() => {
    void (async () => {
      const response = await adminFetch("/api/admin/liveavatar/status");
      if (response.ok) setLiveAvatar(await response.json());
    })();
  }, []);
  const [heygen, setHeygen] = useState<{ connected: boolean; balanceUsd?: number; budget?: { maxPerVideoUsd: number; maxPerDayUsd: number; reserveUsd: number } } | null>(null);
  useEffect(() => {
    void (async () => {
      const response = await adminFetch("/api/admin/heygen/status");
      if (response.ok) setHeygen(await response.json());
    })();
  }, []);
  const brainUrl = typeof window !== "undefined" ? `${window.location.origin}/api/video/llm/${id}` : `/api/video/llm/${id}`;
  const rights = Boolean(avatar.rights_confirmed_at);
  const items: [string, boolean][] = [
    ["Rights confirmed, including permission for a video likeness (Rights tab)", rights],
    ["Avatar brain ready: our server can speak for this avatar to a video provider", status.brainConfigured],
    [heygen?.connected ? `HeyGen connected for recorded video (wallet $${(heygen.balanceUsd ?? 0).toFixed(2)})` : "HeyGen connected for recorded video", Boolean(heygen?.connected)],
    [liveAvatar?.connected ? `LiveAvatar connected for real-time video (${liveAvatar.credits ?? 0} credits)` : "Real-time video provider (LiveAvatar, a separate HeyGen product and account): not connected yet", Boolean(liveAvatar?.connected)],
    ["Creator's footage and recorded consent statement submitted to the provider and verified", consent],
  ];
  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Video avatar</h2>
        <p className="field-hint">
          A video avatar is {avatar.creator_name}&apos;s face speaking live with fans. The face comes from a video provider, trained on the creator&apos;s own footage with their recorded consent. The words come from our server, using the same persona, content, limits and active genre mode as chat and voice. Video is not live for fans yet.
        </p>
        <ul className="admin-checklist">
          {items.map(([label, done]) => (
            <li key={label} className={done ? "done" : ""}>
              <span aria-hidden="true">{done ? "✓" : ""}</span>
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section className="product-card">
        <h2>HeyGen wallet</h2>
        {heygen === null ? (
          <p className="field-hint">Checking…</p>
        ) : heygen.connected ? (
          <>
            <p>
              <span className="status-pill live">Connected</span> Balance <strong>${(heygen.balanceUsd ?? 0).toFixed(2)}</strong>
            </p>
            <p className="field-hint">
              HeyGen bills this wallet per second of generated video. Nothing is generated yet. When generation is added, the server will refuse any video over ${heygen.budget?.maxPerVideoUsd.toFixed(2)}, anything that would pass ${heygen.budget?.maxPerDayUsd.toFixed(2)} a day, and anything that would leave less than ${heygen.budget?.reserveUsd.toFixed(2)} in the wallet.
            </p>
          </>
        ) : (
          <p className="field-hint">HeyGen is not connected.</p>
        )}
      </section>

      <section className="product-card">
        <h2>Real-time video (LiveAvatar)</h2>
        {liveAvatar === null ? (
          <p className="field-hint">Checking…</p>
        ) : liveAvatar.connected ? (
          <>
            <p>
              <span className="status-pill live">Connected</span> Credits left <strong>{liveAvatar.credits ?? 0}</strong>
            </p>
            <p className="field-hint">
              This test runs in LiveAvatar&apos;s sandbox mode only: it uses no credits, lasts about a minute, and shows a public test avatar. It checks that the live connection, video and audio work end to end before any real avatar is used.
            </p>
            <LiveAvatarSandbox />
            <h3 className="form-section-title">Brain test (also free, sandbox only)</h3>
            <p className="field-hint">
              The same live test, but the avatar answers with {avatar.creator_name}&apos;s own brain: the persona, content, limits and active genre mode. It needs the avatar to be live with video switched on, so it only works on a real, approved avatar.
            </p>
            {avatar.status === "live" && avatar.video_config?.enabled ? (
              <LiveAvatarSandbox brainAvatarId={id} />
            ) : (
              <p className="field-hint">Not available yet: this avatar is not live with video turned on.</p>
            )}
          </>
        ) : (
          <p className="field-hint">
            {liveAvatar.error ? `LiveAvatar did not accept the connection: ${liveAvatar.error}` : "Not connected. Create a free account at app.liveavatar.com, copy its API key from the developers page, and add it to Fanline."}
          </p>
        )}
      </section>

      <section className="product-card">
        <h2>Settings</h2>
        <div className="choice-group">
          <span className="choice-label">Video calls</span>
          <div className="choice-row">
            <button type="button" className="choice" aria-pressed={enabled} onClick={() => setEnabled(true)}>
              On
            </button>
            <button type="button" className="choice" aria-pressed={!enabled} onClick={() => setEnabled(false)}>
              Off
            </button>
          </div>
        </div>
        <div className="field-grid">
          <label>
            Provider avatar ID
            <input value={replicaId} onChange={(event) => setReplicaId(event.target.value)} placeholder="Given by the provider once the replica is trained" />
          </label>
          <label>
            Notes (never shown to fans)
            <textarea className="compact-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
        <label className="consent-row live-call-consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>The provider has verified the creator&apos;s recorded consent statement and footage for this replica.</span>
        </label>
        <div className="button-row">
          <button
            className="primary-action"
            disabled={busy === "videocfg"}
            onClick={() => void call("videocfg", `/api/admin/avatars/${id}`, { method: "PATCH", body: JSON.stringify({ video_config: { enabled, replica_id: replicaId, consent_verified: consent, notes } }) }, "Video settings saved.")}
          >
            Save video settings
          </button>
        </div>
        <p className="field-hint">Saving resets approval, so an admin approves the avatar again before fans can reach video.</p>
      </section>

      <section className="product-card">
        <h2>Avatar brain address</h2>
        <p className="field-hint">When the video provider is connected, it is pointed at this address so the face speaks with this avatar&apos;s persona. It is protected by a secret key that is set on the server and is never shown here.</p>
        <div className="share-url-box compact">
          <span>Custom LLM address</span>
          <strong>{brainUrl}</strong>
        </div>
      </section>
    </div>
  );
}

const presetVoiceNames = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];

function VoiceRepliesTab({ id, avatar, busy, call, setError }: { id: string; avatar: Avatar; busy: string; call: Call; setError: (value: string) => void }) {
  const [enabled, setEnabled] = useState(Boolean(avatar.voice_config?.enabled));
  const [voice, setVoice] = useState(avatar.voice_config?.voice || "coral");
  const [instructions, setInstructions] = useState(avatar.voice_config?.instructions || "Speak warmly and naturally, like a friendly person chatting with a fan. Clear, unhurried pace.");
  const [previewing, setPreviewing] = useState(false);
  const [liveOn, setLiveOn] = useState(Boolean(avatar.voice_config?.realtime_enabled));
  const [liveVoice, setLiveVoice] = useState(avatar.voice_config?.realtime_voice || "marin");
  type CallRow = { id: string; started_at: string; status: string; seconds: number; max_seconds: number; ended_reason: string | null; flagged_turns: number; fan_user_id: string; transcript: { role: string; text: string }[] };
  const [calls, setCalls] = useState<CallRow[] | null>(null);
  const [openCall, setOpenCall] = useState("");
  const loadCalls = useCallback(async () => {
    const response = await adminFetch(`/api/admin/avatars/${id}/voice-sessions`);
    if (response.ok) setCalls((await response.json()).sessions);
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void loadCalls());
  }, [loadCalls]);
  const liveAgreement = Boolean(avatar.rights_confirmed_at);
  const voiceAgreement = Boolean(avatar.rights_confirmed_at);

  async function preview() {
    setPreviewing(true);
    setError("");
    const response = await adminFetch(`/api/admin/avatars/${id}/voice/preview`, { method: "POST", body: JSON.stringify({ voice_config: { enabled, voice, instructions, realtime_enabled: liveOn, realtime_voice: liveVoice } }) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Could not generate a preview");
      setPreviewing(false);
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play().catch(() => setError("Your browser blocked audio playback. Click preview again."));
    setPreviewing(false);
  }

  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Voice replies</h2>
        <p className="field-hint">
          Fans can tap Listen on any reply to hear it spoken. This uses a preset AI voice. It is <strong>not</strong> a clone of {avatar.creator_name}&apos;s own voice, and fans are told it is an AI voice.
        </p>
        <div className="choice-group">
          <span className="choice-label">Voice replies</span>
          <div className="choice-row">
            <button type="button" className="choice" aria-pressed={enabled} onClick={() => setEnabled(true)}>
              On
            </button>
            <button type="button" className="choice" aria-pressed={!enabled} onClick={() => setEnabled(false)}>
              Off
            </button>
          </div>
        </div>
        <div className="field-grid">
          <label>
            Voice
            <select value={voice} onChange={(event) => setVoice(event.target.value)}>
              {presetVoiceNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            How it should sound
            <textarea className="compact-textarea" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="e.g. Warm and upbeat, Indian English accent, relaxed pace" />
          </label>
        </div>
        <div className="button-row">
          <button className="secondary-action" disabled={previewing} onClick={() => void preview()}>
            {previewing ? "Generating…" : "Preview this voice"}
          </button>
          <button
            className="primary-action"
            disabled={busy === "voicecfg"}
            onClick={() => void call("voicecfg", `/api/admin/avatars/${id}`, { method: "PATCH", body: JSON.stringify({ voice_config: { enabled, voice, instructions, realtime_enabled: liveOn, realtime_voice: liveVoice } }) }, "Voice settings saved.")}
          >
            Save voice settings
          </button>
        </div>
        <p className="field-hint">Changing voice settings resets approval, so an admin approves the avatar again before fans hear it. The preview reads the greeting. Hindi and other Indian languages work, with quality that varies by voice.</p>
      </section>

      <section className="product-card">
        <h2>Live voice calls</h2>
        <p className="field-hint">
          Fans can talk to the avatar in real time from the fan page, in the language they speak. It uses a preset AI voice, not {avatar.creator_name}&apos;s own, and says it is an AI at the start of every call. Calls are capped at a few minutes, limited per fan per day, and transcribed for review.
        </p>
        <div className="choice-group">
          <span className="choice-label">Live calls</span>
          <div className="choice-row">
            <button type="button" className="choice" aria-pressed={liveOn} onClick={() => setLiveOn(true)}>
              On
            </button>
            <button type="button" className="choice" aria-pressed={!liveOn} onClick={() => setLiveOn(false)}>
              Off
            </button>
          </div>
        </div>
        <div className="field-grid">
          <label>
            Live voice
            <select value={liveVoice} onChange={(event) => setLiveVoice(event.target.value)}>
              {["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="admin-checklist">
          <li className={liveAgreement ? "done" : ""}>
            <span aria-hidden="true">{liveAgreement ? "✓" : ""}</span>
            Rights confirmed (Rights tab). Calls are blocked without it.
          </li>
          <li className={avatar.approval_status === "approved" ? "done" : ""}>
            <span aria-hidden="true">{avatar.approval_status === "approved" ? "✓" : ""}</span>
            Approved by an admin (saving these settings resets approval)
          </li>
        </ul>
        <div className="button-row">
          <button
            className="primary-action"
            disabled={busy === "voicecfg"}
            onClick={() => void call("voicecfg", `/api/admin/avatars/${id}`, { method: "PATCH", body: JSON.stringify({ voice_config: { enabled, voice, instructions, realtime_enabled: liveOn, realtime_voice: liveVoice } }) }, "Voice settings saved.")}
          >
            Save voice settings
          </button>
          <button
            className="secondary-action danger"
            onClick={async () => {
              const response = await adminFetch(`/api/admin/avatars/${id}/voice-sessions`, { method: "POST", body: JSON.stringify({ action: "end_all" }) });
              const data = await response.json();
              setError(response.ok ? "" : data.error || "Could not end the calls");
              if (response.ok) await loadCalls();
            }}
          >
            End all live calls now
          </button>
        </div>

        <h3 className="form-section-title">Recent calls</h3>
        {!calls ? (
          <p className="field-hint">Loading…</p>
        ) : calls.length === 0 ? (
          <p className="field-hint">No calls yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Fan</th>
                <th>Length</th>
                <th>Ended</th>
                <th>Flagged</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {calls.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>{new Date(row.started_at).toLocaleString()}</td>
                    <td>{row.fan_user_id}</td>
                    <td>{row.status === "active" ? "In progress" : `${Math.floor(row.seconds / 60)}m ${row.seconds % 60}s`}</td>
                    <td>{row.ended_reason ? row.ended_reason.replace(/_/g, " ") : "—"}</td>
                    <td>{row.flagged_turns ? <span className="status-pill paused">{row.flagged_turns}</span> : "0"}</td>
                    <td>
                      {row.transcript.length > 0 && (
                        <button className="secondary-action" onClick={() => setOpenCall(openCall === row.id ? "" : row.id)}>
                          {openCall === row.id ? "Hide" : "Transcript"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {openCall === row.id && (
                    <tr>
                      <td colSpan={6}>
                        <ol className="live-captions">
                          {row.transcript.map((turn, index) => (
                            <li key={index} className={turn.role}>
                              <small>{turn.role === "fan" ? "Fan" : "AI avatar"}</small>
                              {turn.text}
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="product-card">
        <h2>{avatar.creator_name}&apos;s own voice</h2>
        <p className="field-hint">A cloned voice is not available yet. It needs:</p>
        <ul className="admin-checklist">
          <li className={voiceAgreement ? "done" : ""}>
            <span aria-hidden="true">{voiceAgreement ? "✓" : ""}</span>
            Rights confirmed, including permission to use their voice (Rights tab)
          </li>
          <li>
            <span aria-hidden="true" />
            Clean voice samples from the creator
          </li>
          <li>
            <span aria-hidden="true" />
            A voice-cloning provider connected to Fanline
          </li>
        </ul>
      </section>
    </div>
  );
}

function TestChat({ id, avatar }: { id: string; avatar: Avatar }) {
  const [turns, setTurns] = useState<{ role: "fan" | "persona"; text: string; flagged?: string | null }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState<{ id: string; name: string }[]>([]);
  const [variantId, setVariantId] = useState("");
  useEffect(() => {
    void (async () => {
      const response = await adminFetch(`/api/admin/avatars/${id}/variants`);
      if (response.ok) setVariants((await response.json()).variants);
    })();
  }, [id]);

  async function send() {
    const message = input.trim();
    if (!message) return;
    setSending(true);
    setError("");
    const history = turns.map((turn) => ({ role: turn.role, text: turn.text }));
    setTurns((current) => [...current, { role: "fan", text: message }]);
    setInput("");
    const response = await adminFetch(`/api/admin/avatars/${id}/test`, { method: "POST", body: JSON.stringify({ message, history, variantId }) });
    const data = await response.json();
    setSending(false);
    if (!response.ok) {
      setError(data.error || "Test failed");
      return;
    }
    setTurns((current) => [...current, { role: "persona", text: data.reply, flagged: data.flagged }]);
  }

  return (
    <section className="product-card">
      <h2>Test as a fan</h2>
      <p className="field-hint">Talk to {avatar.creator_name}&apos;s avatar the way a fan would. Nothing here is saved or shown to fans. Try risky and off-topic questions too.</p>
      {variants.length > 0 && (
        <label className="admin-block">
          Mode
          <select value={variantId} onChange={(event) => { setVariantId(event.target.value); setTurns([]); }}>
            <option value="">Main persona</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="admin-chat" aria-live="polite">
        {turns.length === 0 && <p className="field-hint">Ask a question to begin.</p>}
        {turns.map((turn, index) => (
          <div key={index} className={`message ${turn.role === "fan" ? "fan" : ""}`}>
            {turn.text}
            {turn.flagged && <small className="flag-label">Held by limit: {turn.flagged}</small>}
          </div>
        ))}
        {sending && <div className="message">Thinking…</div>}
      </div>
      {error && <p className="field-error">{error}</p>}
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a fan question…" aria-label="Test message" disabled={sending} />
        <button className="primary-action" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

function ApprovalTab({ id, role, avatar, checklist, activity, busy, call }: { id: string; role: Role; avatar: Avatar; checklist: { label: string; done: boolean }[]; activity: Activity[]; busy: string; call: Call }) {
  const [reference, setReference] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const lastChange = activity.find((entry) => entry.action === "changes_requested");
  const ready = checklist.slice(0, 3).every((item) => item.done);
  const post = (label: string, path: string, body: Record<string, unknown>, success: string) => call(label, path, { method: "POST", body: JSON.stringify(body) }, success);

  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Approval</h2>
        <p>
          Status: <strong>{{ none: "Not submitted", pending: "Awaiting admin approval", approved: "Approved", changes_requested: "Changes requested" }[avatar.approval_status]}</strong>
          {avatar.approved_by_email && ` (by ${avatar.approved_by_email})`}
        </p>
        {avatar.approval_status === "changes_requested" && lastChange && <p className="field-error">Requested changes: {String(lastChange.details.note || "")}</p>}
        <ul className="admin-checklist">
          {checklist.map((item) => (
            <li key={item.label} className={item.done ? "done" : ""}>
              <span aria-hidden="true">{item.done ? "✓" : ""}</span>
              {item.label}
            </li>
          ))}
        </ul>
        <p className="field-hint">Any later edit to the content, voice or limits resets approval, and pauses the avatar if it is live.</p>

        {(avatar.approval_status === "none" || avatar.approval_status === "changes_requested") && (
          <div className="button-row">
            <button className="primary-action" disabled={!ready || busy === "submit"} onClick={() => void post("submit", `/api/admin/avatars/${id}/review`, { decision: "submit" }, "Submitted for approval.")}>
              Submit for approval
            </button>
          </div>
        )}
      </section>

      {role === "admin" && avatar.approval_status === "pending" && (
        <section className="product-card admin-form">
          <h2>Approve</h2>
          <p className="field-hint">Review the avatar, try it in the test chat, then approve. A reference is optional, for example &ldquo;approved on WhatsApp, 12 Oct&rdquo;.</p>
          <div className="field-grid">
            <label>
              Approval reference (optional)
              <input value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-action" disabled={busy === "approve"} onClick={() => void post("approve", `/api/admin/avatars/${id}/review`, { decision: "approve", reference }, "Approved.")}>
              Approve
            </button>
          </div>
          <label className="admin-block">
            Or ask for changes
            <textarea className="compact-textarea" value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="What needs to change?" />
          </label>
          <div className="button-row">
            <button className="secondary-action" disabled={!changeNote.trim() || busy === "changes"} onClick={() => void post("changes", `/api/admin/avatars/${id}/review`, { decision: "request_changes", note: changeNote }, "Changes requested.")}>
              Request changes
            </button>
          </div>
        </section>
      )}

      {avatar.approval_status === "pending" && role !== "admin" && (
        <section className="product-card">
          <p>This avatar is waiting for an admin to approve it.</p>
        </section>
      )}

      {role === "admin" && avatar.approval_status === "approved" && (
        <section className="product-card">
          <h2>Publish</h2>
          <p>{avatar.status === "live" ? "This avatar is live for fans." : "Approved and ready. Publishing makes the fan chat public."}</p>
          <div className="button-row">
            {avatar.status !== "live" ? (
              <button className="primary-action" disabled={busy === "publish"} onClick={() => void post("publish", `/api/admin/avatars/${id}/status`, { status: "live" }, "Published. The fan chat is live.")}>
                Publish to fans
              </button>
            ) : (
              <button className="secondary-action" disabled={busy === "pause"} onClick={() => void post("pause", `/api/admin/avatars/${id}/status`, { status: "paused" }, "Paused.")}>
                Pause
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ActivityTab({ activity }: { activity: Activity[] }) {
  return (
    <section className="product-card">
      <h2>Activity</h2>
      <p className="field-hint">An append-only record of every staff action on this avatar.</p>
      {activity.length === 0 ? (
        <p>No activity yet.</p>
      ) : (
        <ol className="admin-activity">
          {activity.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.action.replace(/_/g, " ")}</strong>
              <span>
                {entry.actor_email} · {new Date(entry.created_at).toLocaleString()}
              </span>
              {Object.keys(entry.details || {}).length > 0 && <code>{JSON.stringify(entry.details)}</code>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function AdminAvatarPage() {
  return <AdminGate>{({ role }) => <Workspace role={role} />}</AdminGate>;
}
