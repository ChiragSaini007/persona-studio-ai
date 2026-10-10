import { PersonaRecord } from "./persona";
import { supabaseRest } from "./supabase-rest";

// A variant is a genre "mode" of one avatar (Action, Horror, Romance...). It can only ADD style and restrictions.
// It can never switch off the main persona's limits.

export type VariantOverlay = {
  styleNotes: string;
  extraInstructions: string;
  greeting: string;
  voiceInstructions: string;
  extraAvoid: string[];
  extraNeverSay: string[];
};

export type Variant = {
  id: string;
  persona_id: string;
  name: string;
  genre: string;
  description: string;
  overlay: VariantOverlay;
  status: "active" | "archived";
  approval_status: "none" | "pending" | "approved" | "changes_requested";
  approved_by_email: string | null;
  approved_at: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export const genreTemplates: { genre: string; label: string; overlay: VariantOverlay }[] = [
  {
    genre: "action",
    label: "Action",
    overlay: {
      styleNotes: "High-energy, confident, punchy short sentences. Playful bravado, never encouraging real violence.",
      extraInstructions: "",
      greeting: "",
      voiceInstructions: "Energetic, confident, quick and punchy delivery.",
      extraAvoid: ["how to hurt someone", "weapon instructions"],
      extraNeverSay: [],
    },
  },
  {
    genre: "horror",
    label: "Horror",
    overlay: {
      styleNotes: "Slow, atmospheric, suspenseful and a little eerie. Keep it suggestive, never graphic, nothing that could cause real-world harm.",
      extraInstructions: "",
      greeting: "",
      voiceInstructions: "Low, slow and hushed, with suspenseful pauses.",
      extraAvoid: ["graphic violence", "self-harm", "suicide"],
      extraNeverSay: [],
    },
  },
  {
    genre: "romance",
    label: "Romance",
    overlay: {
      styleNotes: "Warm, charming and sincere. Light playfulness at most, always respectful and suitable for all audiences.",
      extraInstructions: "",
      greeting: "",
      voiceInstructions: "Soft, warm and gentle.",
      extraAvoid: ["sexual content", "explicit"],
      extraNeverSay: ["I love you"],
    },
  },
  {
    genre: "comedy",
    label: "Comedy",
    overlay: {
      styleNotes: "Quick-witted, self-aware humour. Never mock real people, religions, castes or communities.",
      extraInstructions: "",
      greeting: "",
      voiceInstructions: "Light, playful and well-timed.",
      extraAvoid: ["jokes about religion", "jokes about caste", "jokes about communities"],
      extraNeverSay: [],
    },
  },
  {
    genre: "thriller",
    label: "Thriller",
    overlay: {
      styleNotes: "Tense, controlled and economical. Short lines, a sense of something unsaid.",
      extraInstructions: "",
      greeting: "",
      voiceInstructions: "Calm, controlled and intense.",
      extraAvoid: ["graphic violence"],
      extraNeverSay: [],
    },
  },
  {
    genre: "drama",
    label: "Drama",
    overlay: {
      styleNotes: "Thoughtful, emotional and measured. Speak with sincerity and weight.",
      extraInstructions: "",
      greeting: "",
      voiceInstructions: "Warm, measured and heartfelt.",
      extraAvoid: [],
      extraNeverSay: [],
    },
  },
  {
    genre: "family",
    label: "Family",
    overlay: {
      styleNotes: "Gentle, warm and wholesome. Suitable for all ages.",
      extraInstructions: "",
      greeting: "",
      voiceInstructions: "Gentle, friendly and clear.",
      extraAvoid: ["mature themes"],
      extraNeverSay: [],
    },
  },
  {
    genre: "custom",
    label: "Custom",
    overlay: { styleNotes: "", extraInstructions: "", greeting: "", voiceInstructions: "", extraAvoid: [], extraNeverSay: [] },
  },
];

const list = (value: unknown, max = 20) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item).trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, max);

export function normalizeOverlay(raw: unknown): VariantOverlay {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<VariantOverlay>;
  const text = (input: unknown, max: number) => (typeof input === "string" ? input.trim().slice(0, max) : "");
  return {
    styleNotes: text(value.styleNotes, 600),
    extraInstructions: text(value.extraInstructions, 1000),
    greeting: text(value.greeting, 400),
    voiceInstructions: text(value.voiceInstructions, 300),
    extraAvoid: list(value.extraAvoid),
    extraNeverSay: list(value.extraNeverSay),
  };
}

export function applyVariant<T extends PersonaRecord>(persona: T, variant: Pick<Variant, "name" | "genre" | "overlay">): T {
  const o = normalizeOverlay(variant.overlay);
  const modeNote = `Genre mode "${variant.name}" (${variant.genre}): ${o.styleNotes}`.trim();
  return {
    ...persona,
    profile: {
      ...persona.profile,
      responseStyle: [persona.profile.responseStyle, modeNote, o.extraInstructions].filter(Boolean).join(" "),
      greetingStyle: o.greeting || persona.profile.greetingStyle,
      neverSay: [...(persona.profile.neverSay || []), ...o.extraNeverSay],
    },
    // the main persona's guardrails stay exactly as they are; a variant can only add topics to avoid
    custom_boundary: [persona.custom_boundary, ...o.extraAvoid].filter(Boolean).join(", "),
  };
}

export async function loadVariant(variantId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) return null;
  const rows = await supabaseRest<Variant[]>(`persona_variants?id=eq.${variantId}&select=*`);
  return rows[0] || null;
}

// What fans actually talk to: the main persona, or its active variant when that variant is approved.
export async function resolveActivePersona<T extends PersonaRecord & { active_variant_id?: string | null }>(persona: T) {
  if (!persona.active_variant_id) return { persona, variant: null as Variant | null };
  try {
    const variant = await loadVariant(persona.active_variant_id);
    if (variant && variant.persona_id === persona.id && variant.status === "active" && variant.approval_status === "approved") {
      return { persona: applyVariant(persona, variant), variant };
    }
  } catch {
    // fall back to the main persona
  }
  return { persona, variant: null as Variant | null };
}
