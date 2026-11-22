import type { TopicExtrasRead } from "../types/topic-extras";

/**
 * The co-supervisor, the short description and the type of a topic, as its
 * forms hold them — and as the official list numbers and colours them.
 */

export const SUMMARY_MAX = 300;

/** A form's state: an empty string for «none». */
export interface TopicExtrasValue {
  coSupervisorId: string;
  summary: string;
  typeId: string;
}

export const EMPTY_EXTRAS: TopicExtrasValue = { coSupervisorId: "", summary: "", typeId: "" };

/** What an existing topic holds, for its edit form. */
export const extrasOf = (t?: TopicExtrasRead | null): TopicExtrasValue => ({
  coSupervisorId: t?.coSupervisor?.id ?? t?.coSupervisorId ?? "",
  summary: t?.summary ?? "",
  typeId: t?.type?.id ?? t?.typeId ?? "",
});

/**
 * What the request sends. A new topic leaves out what is empty; an edit sends
 * `null` for it — that is how a field is cleared.
 */
export function extrasPayload(v: TopicExtrasValue, edit = false) {
  const none = edit ? null : undefined;
  return {
    coSupervisorId: v.coSupervisorId || none,
    summary: v.summary.trim() || none,
    typeId: v.typeId || none,
  };
}

/**
 * The code of each row, in order: the type's letters and its count so far —
 * AI01, AI02, IoT01… A row without a type gets none.
 */
export function typeCodes(rows: { type?: { id: string; code: string } | null }[]): (string | null)[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    if (!r.type) return null;
    const n = (seen.get(r.type.id) ?? 0) + 1;
    seen.set(r.type.id, n);
    return `${r.type.code}${String(n).padStart(2, "0")}`;
  });
}

/**
 * The colours a type may take: light tints, so black text on them reads and
 * prints — the department's list has its rows in such colours.
 */
export const TYPE_COLORS = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#ede9fe",
  "#cffafe",
  "#ffedd5",
  "#e0e7ff",
  "#f1f5f9",
  "#fee2e2",
  "#ecfccb",
  "#f5f5dc",
] as const;

/** A darker shade of a tint, for its border and its swatch's ring. */
export function deeper(hex: string, amount = 0.28): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}
