// HeyGen (recorded avatar video). Uses the current v3 API; the v2 endpoints are being retired on 2026-10-31.
// The API key is a prepaid USD wallet billed per second of output, so everything here is read-only for now.
// Any future generation call must go through assertWithinBudget first.

const base = "https://api.heygen.com";

export function heygenConfigured() {
  return Boolean(process.env.HEYGEN_API_KEY);
}

async function heygen<T>(path: string): Promise<T> {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HeyGen is not connected");
  const response = await fetch(`${base}${path}`, { headers: { "X-Api-Key": key, Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`HeyGen request failed (${response.status})`);
  return (await response.json()) as T;
}

export async function heygenWallet() {
  const data = await heygen<{ data?: { billing_type?: string; wallet?: { currency?: string; remaining_balance?: number } } }>("/v3/users/me");
  return {
    billingType: data.data?.billing_type || "unknown",
    currency: data.data?.wallet?.currency || "usd",
    balanceUsd: Number(data.data?.wallet?.remaining_balance ?? 0),
  };
}

// ---- spend guard ----
// Rough per-second prices from third-party sources (verify against the HeyGen rate card). Used only to refuse risky spend.
export const heygenRatePerSecondUsd = { avatar3Twin: 0.0167, avatar4: 0.0667 } as const;

export function heygenBudget() {
  return {
    maxPerVideoUsd: Number(process.env.HEYGEN_MAX_PER_VIDEO_USD) || 0.5,
    maxPerDayUsd: Number(process.env.HEYGEN_MAX_PER_DAY_USD) || 1,
    reserveUsd: Number(process.env.HEYGEN_RESERVE_USD) || 1,
  };
}

// Refuses a generation if it could exceed the per-video cap, the daily cap, or dip into the reserve.
export function assertWithinBudget(input: { seconds: number; ratePerSecondUsd: number; spentTodayUsd: number; balanceUsd: number }) {
  const budget = heygenBudget();
  const estimate = input.seconds * input.ratePerSecondUsd * 1.25; // 25% safety margin
  if (estimate > budget.maxPerVideoUsd) throw new Error(`Estimated cost $${estimate.toFixed(2)} is over the $${budget.maxPerVideoUsd.toFixed(2)} per-video limit`);
  if (input.spentTodayUsd + estimate > budget.maxPerDayUsd) throw new Error(`This would go over today's $${budget.maxPerDayUsd.toFixed(2)} limit`);
  if (input.balanceUsd - estimate < budget.reserveUsd) throw new Error(`This would leave less than the $${budget.reserveUsd.toFixed(2)} reserve in the wallet`);
  return estimate;
}
