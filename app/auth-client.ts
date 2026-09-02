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

function friendlyAuthError(message: string, mode: "signup" | "signin") {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before logging in. You can resend the confirmation email below.";
  }

  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
    return "The email or password is incorrect. Please check both and try again.";
  }

  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "An account already exists for this email. Switch to Log in to continue.";
  }

  if (normalized.includes("password")) {
    return "Please use a stronger password and try again.";
  }

  if (normalized.includes("rate") || normalized.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }

  if (normalized.includes("confirm") || normalized.includes("verify")) {
    return "Please confirm your email before logging in. You can resend the confirmation email below.";
  }

  return mode === "signup"
    ? "We could not create the account. Please check your details and try again."
    : "We could not log you in. Please check your details and try again.";
}

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
  if (!response.ok) {
    throw new Error(friendlyAuthError(data.error_description || data.msg || data.message || "", mode));
  }

  if (!data.access_token) {
    throw new Error(
      mode === "signup"
        ? "Account created. Please confirm your email, then log in to continue."
        : "We could not start your session. Please try logging in again.",
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

export async function resendSignupConfirmation(email: string) {
  const { url, anonKey } = supabaseAuthConfig();
  const redirectTo = typeof window === "undefined" ? "" : `${window.location.origin}/creator`;
  const response = await fetch(`${url}/auth/v1/resend`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "signup",
      email,
      options: redirectTo ? { email_redirect_to: redirectTo } : undefined,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("We could not resend the confirmation email. Please wait a minute and try again.");
  }
  return data;
}
