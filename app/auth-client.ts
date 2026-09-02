"use client";

type AuthSession = {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: string;
    email?: string;
  };
};

const sessionKey = "persona-studio-auth-session";

function supabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lrpztqhkgozbpmuvboww.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_10HMrPVHsuzt0_4Lb3eyEA_78n8TqWM";
  return { url: url.replace(/\/$/, ""), anonKey };
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(sessionKey);
  return saved ? JSON.parse(saved) : null;
}

export function clearStoredSession() {
  window.localStorage.removeItem(sessionKey);
}

export async function supabasePasswordAuth(mode: "signup" | "signin", email: string, password: string) {
  const { url, anonKey } = supabaseAuthConfig();
  const endpoint = mode === "signup" ? "signup" : "token?grant_type=password";
  const redirectTo = typeof window === "undefined" ? "" : `${window.location.origin}/creator`;
  const authUrl =
    mode === "signup" && redirectTo
      ? `${url}/auth/v1/${endpoint}?redirect_to=${encodeURIComponent(redirectTo)}`
      : `${url}/auth/v1/${endpoint}`;
  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Authentication failed");
  if (!data.access_token) {
    throw new Error(
      mode === "signup"
        ? "Account created, but Supabase requires email confirmation before login. Confirm the email, then switch to Sign in."
        : "Signed in response did not include a session. Check Supabase Auth email/password settings.",
    );
  }

  const session: AuthSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  };

  window.localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}
