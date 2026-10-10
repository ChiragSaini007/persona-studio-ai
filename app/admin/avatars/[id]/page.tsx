"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { guardrails } from "../../../persona-model";
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
  voice_config?: { enabled?: boolean; voice?: string; instructions?: string; realtime_enabled?: boolean; realtime_voice?: string };
};

type Agreement = {
  id: string;
  channel: string;
  signed_by_name: string;
  signer_role: string;
  signed_on: string;
  expires_on: string | null;
  scope_notes: string;
  status: "active" | "revoked";
  uploaded_by_email: string;
};

type Activity = { id: string; action: string; actor_email: string; details: Record<string, unknown>; created_at: string };

const tabs = ["Overview", "Agreements", "Content", "Voice and limits", "Voice", "Test chat", "Approval", "Activity"] as const;
type Tab = (typeof tabs)[number];

const channelOptions = [
  { value: "text", label: "Text chat", live: true },
  { value: "voice", label: "Voice (recorded)", live: false },
  { value: "realtime_voice", label: "Real-time voice", live: false },
  { value: "video", label: "Video (recorded)", live: false },
  { value: "realtime_video", label: "Real-time video", live: false },
];

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
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
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
    setAgreements(data.agreements);
    setActivity(data.activity);
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

  const activeText = agreements.find((item) => item.channel === "text" && item.status === "active" && (!item.expires_on || item.expires_on >= today()));
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
    { label: "Signed text agreement on file", done: Boolean(activeText) },
    { label: "Content added (200+ characters)", done: avatar.source_content.trim().length >= 200 },
    { label: "Voice and topics drafted or edited", done: drafted },
    { label: "Submitted for approval", done: avatar.approval_status === "pending" || avatar.approval_status === "approved" },
    { label: "Creator sign-off recorded and approved", done: avatar.approval_status === "approved" },
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

      {error && <div className="system-notice" role="alert">{error}</div>}
      {notice && <div className="success-notice" role="status">{notice}</div>}

      {tab === "Overview" && (
        <OverviewTab avatar={avatar} checklist={checklist} busy={busy} onSave={(notes) => call("notes", `/api/admin/avatars/${id}`, { method: "PATCH", body: JSON.stringify(notes) }, "Saved.")} />
      )}
      {tab === "Agreements" && <AgreementsTab id={id} role={role} agreements={agreements} busy={busy} call={call} setError={setError} />}
      {tab === "Content" && <ContentTab id={id} avatar={avatar} hasAgreement={Boolean(activeText)} busy={busy} call={call} />}
      {tab === "Voice and limits" && <VoiceTab id={id} avatar={avatar} busy={busy} call={call} />}
      {tab === "Voice" && <VoiceRepliesTab id={id} avatar={avatar} agreements={agreements} busy={busy} call={call} setError={setError} />}
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

function AgreementsTab({ id, role, agreements, busy, call, setError }: { id: string; role: Role; agreements: Agreement[]; busy: string; call: Call; setError: (value: string) => void }) {
  const [form, setForm] = useState({ channel: "text", signed_by_name: "", signer_role: "creator", signed_on: today(), expires_on: "", scope_notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  async function upload() {
    if (!file) {
      setError("Attach the signed agreement first.");
      return;
    }
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append("file", file);
    const result = await call("upload", `/api/admin/avatars/${id}/agreements`, { method: "POST", body }, "Agreement saved.");
    if (result) {
      setFile(null);
      setFileKey((key) => key + 1);
      setForm({ ...form, signed_by_name: "", scope_notes: "" });
    }
  }

  async function view(agreementId: string) {
    const response = await adminFetch(`/api/admin/avatars/${id}/agreements/${agreementId}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not open the agreement");
      return;
    }
    window.open(data.url, "_blank", "noopener");
  }

  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Signed agreements</h2>
        <p className="field-hint">
          Nothing can be trained or published without an active signed agreement. Make sure it covers the creator&apos;s consent for how their data and
          likeness are used (including under India&apos;s Digital Personal Data Protection Act), and any rules on labelling AI-generated content. Have your
          lawyer confirm the wording.
        </p>
        {agreements.length === 0 ? (
          <div className="empty-state">
            <strong>No agreements yet</strong>
            <p>Upload the signed document below.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Signed by</th>
                <th>Signed on</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {agreements.map((agreement) => (
                <tr key={agreement.id}>
                  <td>{channelOptions.find((option) => option.value === agreement.channel)?.label || agreement.channel}</td>
                  <td>
                    {agreement.signed_by_name}
                    <small>{agreement.signer_role === "creator" ? "Creator" : "Authorised representative"}</small>
                  </td>
                  <td>{agreement.signed_on}</td>
                  <td>{agreement.expires_on || "No expiry"}</td>
                  <td>
                    <span className={`status-pill ${agreement.status === "active" ? "live" : "paused"}`}>{agreement.status}</span>
                  </td>
                  <td className="admin-row-actions">
                    <button className="secondary-action" onClick={() => void view(agreement.id)}>
                      View document
                    </button>
                    {role === "admin" && agreement.status === "active" && (
                      <button
                        className="secondary-action danger"
                        disabled={busy === "revoke"}
                        onClick={() => {
                          if (window.confirm("Revoke this agreement? A revoked text agreement pauses the avatar immediately.")) {
                            void call("revoke", `/api/admin/avatars/${id}/agreements/${agreement.id}`, { method: "DELETE" }, "Agreement revoked.");
                          }
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="product-card admin-form">
        <h2>Upload an agreement</h2>
        <div className="field-grid">
          <label>
            Covers
            <select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })}>
              {channelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.live ? "" : " (not active yet)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Signed by (full name)
            <input value={form.signed_by_name} onChange={(event) => setForm({ ...form, signed_by_name: event.target.value })} />
          </label>
          <label>
            Signer is
            <select value={form.signer_role} onChange={(event) => setForm({ ...form, signer_role: event.target.value })}>
              <option value="creator">The creator or celebrity</option>
              <option value="authorised_representative">An authorised representative</option>
            </select>
          </label>
          <label>
            Date signed
            <input type="date" value={form.signed_on} onChange={(event) => setForm({ ...form, signed_on: event.target.value })} />
          </label>
          <label>
            Expires (optional)
            <input type="date" value={form.expires_on} onChange={(event) => setForm({ ...form, expires_on: event.target.value })} />
          </label>
          <label>
            Scope notes (optional)
            <textarea className="compact-textarea" value={form.scope_notes} onChange={(event) => setForm({ ...form, scope_notes: event.target.value })} />
          </label>
          <label>
            Signed document (PDF, PNG, JPG or WebP, up to 10 MB)
            <input key={fileKey} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="button-row">
          <button className="primary-action" disabled={busy === "upload" || !form.signed_by_name.trim() || !file} onClick={() => void upload()}>
            {busy === "upload" ? "Uploading…" : "Save agreement"}
          </button>
        </div>
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
        {!hasAgreement && <p className="field-hint">Adding files unlocks once an active signed text agreement is uploaded.</p>}
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
            title={!hasAgreement ? "Upload an active signed text agreement first" : content !== avatar.source_content ? "Save the content first" : ""}
            onClick={() => void call("draft", `/api/admin/avatars/${id}/draft`, { method: "POST" }, "Voice and topics drafted from the content.")}
          >
            {busy === "draft" ? "Drafting…" : "Draft voice and topics"}
          </button>
        </div>
        {!hasAgreement && <p className="field-error">Training is locked until an active signed text agreement is uploaded.</p>}
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

const presetVoiceNames = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];

function VoiceRepliesTab({ id, avatar, agreements, busy, call, setError }: { id: string; avatar: Avatar; agreements: Agreement[]; busy: string; call: Call; setError: (value: string) => void }) {
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
  const liveAgreement = agreements.some((item) => item.channel === "realtime_voice" && item.status === "active" && (!item.expires_on || item.expires_on >= today()));
  const voiceAgreement = agreements.some((item) => item.channel === "voice" && item.status === "active" && (!item.expires_on || item.expires_on >= today()));

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
            A signed real-time voice agreement on file (Agreements tab, channel &ldquo;Real-time voice&rdquo;). Calls are blocked without it.
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
            A signed voice agreement on file (upload it on the Agreements tab, channel &ldquo;Voice&rdquo;)
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

  async function send() {
    const message = input.trim();
    if (!message) return;
    setSending(true);
    setError("");
    const history = turns.map((turn) => ({ role: turn.role, text: turn.text }));
    setTurns((current) => [...current, { role: "fan", text: message }]);
    setInput("");
    const response = await adminFetch(`/api/admin/avatars/${id}/test`, { method: "POST", body: JSON.stringify({ message, history }) });
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
  const [signoff, setSignoff] = useState({ by: "", method: "email", date: today(), reference: "" });
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
          <h2>Record the creator&apos;s sign-off and approve</h2>
          <p className="field-hint">The creator or their representative must have reviewed this avatar and agreed to it going live. Record how, so there is a trail.</p>
          <div className="field-grid">
            <label>
              Who signed off
              <input value={signoff.by} onChange={(event) => setSignoff({ ...signoff, by: event.target.value })} />
            </label>
            <label>
              How
              <select value={signoff.method} onChange={(event) => setSignoff({ ...signoff, method: event.target.value })}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Phone call</option>
                <option value="meeting">Meeting</option>
                <option value="portal">Creator portal</option>
              </select>
            </label>
            <label>
              Date
              <input type="date" value={signoff.date} onChange={(event) => setSignoff({ ...signoff, date: event.target.value })} />
            </label>
            <label>
              Reference (message link, ticket, notes)
              <input value={signoff.reference} onChange={(event) => setSignoff({ ...signoff, reference: event.target.value })} />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-action" disabled={!signoff.by.trim() || busy === "approve"} onClick={() => void post("approve", `/api/admin/avatars/${id}/review`, { decision: "approve", signoff }, "Approved.")}>
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
          <p>This avatar is waiting for an admin to record the creator&apos;s sign-off and approve it.</p>
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
