"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

const tabs = ["Overview", "Agreements", "Content", "Voice and limits", "Test chat", "Approval", "Activity"] as const;
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

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const parts: string[] = [];
    for (const file of Array.from(files)) {
      if (!/\.(txt|md|srt|vtt|csv|json)$/i.test(file.name)) continue;
      parts.push(`# ${file.name}\n${await file.text()}`);
    }
    if (parts.length) setContent((current) => [current.trim(), ...parts].filter(Boolean).join("\n\n"));
  }

  return (
    <div className="screen-stack">
      <section className="product-card">
        <h2>Training content</h2>
        <p className="field-hint">Everything the creator has approved for their avatar to draw on: captions, transcripts, interviews, FAQs, press kits. Plain text files can be added directly. PDFs and audio are coming.</p>
        <textarea className="admin-content" value={content} onChange={(event) => setContent(event.target.value)} aria-label="Training content" />
        <div className="material-helper">
          <span>{content.trim().length.toLocaleString()} characters</span>
          <input type="file" multiple accept=".txt,.md,.srt,.vtt,.csv,.json,text/plain" onChange={(event) => void addFiles(event.target.files)} aria-label="Add text files" />
        </div>
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
