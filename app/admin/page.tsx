"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminGate, adminFetch, type Role } from "./admin-client";

type AvatarRow = {
  id: string;
  creator_name: string;
  creator_handle: string;
  status: string;
  approval_status: string;
  claim_email: string | null;
  is_example?: boolean;
  agreement_channels: string[];
  updated_at: string;
};

const channelLabel: Record<string, string> = {
  text: "Text",
  voice: "Voice",
  realtime_voice: "Live voice",
  video: "Video",
  realtime_video: "Live video",
};

const approvalLabel: Record<string, string> = {
  none: "Not submitted",
  pending: "Awaiting approval",
  approved: "Approved",
  changes_requested: "Changes requested",
};

function AvatarList({ role }: { role: Role }) {
  const [avatars, setAvatars] = useState<AvatarRow[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ creator_name: "", creator_handle: "", claim_email: "", internal_notes: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await adminFetch("/api/admin/avatars");
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not load avatars");
      return;
    }
    setError("");
    setAvatars(data.avatars);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function create() {
    setSaving(true);
    setFormError("");
    const response = await adminFetch("/api/admin/avatars", { method: "POST", body: JSON.stringify(form) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setFormError(data.error || "Could not create the avatar");
      return;
    }
    window.location.href = `/admin/avatars/${data.avatar.id}`;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Avatars</h1>
          <p>Every avatar your team manages for creators and celebrities who have signed an agreement.</p>
        </div>
        <div className="page-header-actions">
          {avatars && !avatars.some((avatar) => avatar.is_example) && (
            <button
              className="secondary-action"
              onClick={async () => {
                const response = await adminFetch("/api/admin/avatars", { method: "POST", body: JSON.stringify({ example: true }) });
                const data = await response.json();
                if (!response.ok) setError(data.error || "Could not add the example");
                else window.location.href = `/admin/avatars/${data.avatar.id}`;
              }}
            >
              Add example avatar
            </button>
          )}
          <button className="primary-action" onClick={() => setCreating((open) => !open)}>
            {creating ? "Close" : "New avatar"}
          </button>
        </div>
      </header>

      {creating && (
        <section className="product-card admin-form">
          <h2>New avatar</h2>
          <p className="field-hint">Create the record first. You can upload the signed agreement and add content on the next screen.</p>
          <div className="field-grid">
            <label>
              Creator or celebrity name
              <input value={form.creator_name} onChange={(event) => setForm({ ...form, creator_name: event.target.value })} />
            </label>
            <label>
              Public handle
              <input value={form.creator_handle} placeholder="e.g. shahrukhkhan" onChange={(event) => setForm({ ...form, creator_handle: event.target.value })} />
            </label>
            <label>
              Their email (so they can claim it later)
              <input type="email" value={form.claim_email} onChange={(event) => setForm({ ...form, claim_email: event.target.value })} />
            </label>
            <label>
              Internal notes
              <textarea className="compact-textarea" value={form.internal_notes} onChange={(event) => setForm({ ...form, internal_notes: event.target.value })} />
            </label>
          </div>
          {formError && <p className="field-error">{formError}</p>}
          <div className="button-row">
            <button className="primary-action" onClick={() => void create()} disabled={saving || !form.creator_name.trim() || !form.creator_handle.trim()}>
              {saving ? "Creating…" : "Create avatar"}
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="system-notice" role="alert">
          {error}
        </div>
      )}

      <section className="product-card admin-table-card">
        {!avatars && !error && <p>Loading…</p>}
        {avatars && !avatars.length && (
          <div className="empty-state">
            <strong>No avatars yet</strong>
            <p>Create one to start. {role === "admin" ? "As an admin you can also approve and publish." : "An admin approves and publishes."}</p>
          </div>
        )}
        {avatars && avatars.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Status</th>
                <th>Approval</th>
                <th>Signed agreements</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {avatars.map((avatar) => (
                <tr key={avatar.id}>
                  <td>
                    <strong>
                      {avatar.creator_name} {avatar.is_example && <span className="status-pill soon">Example</span>}
                    </strong>
                    <small>@{avatar.creator_handle}</small>
                  </td>
                  <td>
                    <span className={`status-pill ${avatar.status === "live" ? "live" : avatar.status === "paused" ? "paused" : "draft"}`}>{avatar.status}</span>
                  </td>
                  <td>{approvalLabel[avatar.approval_status] || avatar.approval_status}</td>
                  <td>
                    {avatar.agreement_channels.length ? (
                      <span className="chip-wrap">
                        {avatar.agreement_channels.map((channel) => (
                          <span key={channel} className="status-pill soon">
                            {channelLabel[channel] || channel}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="status-pill paused">None</span>
                    )}
                  </td>
                  <td>{new Date(avatar.updated_at).toLocaleDateString()}</td>
                  <td>
                    <Link className="secondary-action" href={`/admin/avatars/${avatar.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export default function AdminHome() {
  return <AdminGate>{({ role }) => <AvatarList role={role} />}</AdminGate>;
}
