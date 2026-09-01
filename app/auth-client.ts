"use client";

type AuthSession = {
  access_token: string;
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
  const response = await fetch(`${url}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Authentication failed");

  const session: AuthSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  };

  window.localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}
