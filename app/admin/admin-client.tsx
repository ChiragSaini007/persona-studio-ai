"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { clearStoredSession, getStoredSession, refreshStoredSession, supabasePasswordAuth } from "../auth-client";

export type Role = "admin" | "ops";

export async function adminFetch(path: string, init: RequestInit = {}) {
  const run = (token: string) =>
    fetch(path, {
      ...init,
      headers: {
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  let response = await run(getStoredSession()?.access_token || "");
  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshStoredSession();
    if (refreshed?.access_token) response = await run(refreshed.access_token);
  }
  return response;
}

type Gate = { state: "loading" } | { state: "signed-out" } | { state: "denied"; email: string } | { state: "ready"; email: string; role: Role };

// Handles sign-in and the staff check, then renders the admin shell.
export function AdminGate({ children }: { children: (ctx: { email: string; role: Role }) => ReactNode }) {
  const [gate, setGate] = useState<Gate>({ state: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    const session = getStoredSession();
    if (!session?.access_token) {
      setGate({ state: "signed-out" });
      return;
    }
    const response = await adminFetch("/api/admin/me");
    if (response.ok) {
      const data = await response.json();
      setGate({ state: "ready", email: data.email, role: data.role });
    } else {
      setGate({ state: "denied", email: getStoredSession()?.user?.email || "" });
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void check());
  }, [check]);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await supabasePasswordAuth("signin", email, password);
      setPassword("");
      await check();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearStoredSession();
    setGate({ state: "signed-out" });
  }

  if (gate.state === "loading") {
    return <div className="console"><div className="admin-center">Checking access…</div></div>;
  }

  if (gate.state === "signed-out") {
    return (
      <div className="console">
        <div className="admin-center">
          <form
            className="product-card admin-login"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            <h1>Fanline Admin</h1>
            <p>Staff sign-in. Access is limited to approved team members.</p>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
            {error && <p className="field-error">{error}</p>}
            <button className="primary-action" disabled={busy || !email || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (gate.state === "denied") {
    return (
      <div className="console">
        <div className="admin-center">
          <div className="product-card admin-login">
            <h1>No access</h1>
            <p>{gate.email ? `${gate.email} is not on the staff list.` : "This account is not on the staff list."} Ask an admin to add you.</p>
            <button className="secondary-action" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="console">
      <header className="console-topbar">
        <Link href="/admin" className="wordmark">
          Fanline
        </Link>
        <span className="console-crumb">Admin console</span>
        <div className="console-topbar-right">
          <span className={`status-pill ${gate.role === "admin" ? "live" : "soon"}`}>{gate.role === "admin" ? "Admin" : "Ops"}</span>
          <span className="account-chip">
            <span title={gate.email}>{gate.email}</span>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </span>
        </div>
      </header>
      <main className="admin-main">{children({ email: gate.email, role: gate.role })}</main>
    </div>
  );
}
