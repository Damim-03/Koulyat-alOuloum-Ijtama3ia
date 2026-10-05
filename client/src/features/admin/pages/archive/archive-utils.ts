import type { Mention, YearDefense, YearRecord } from "../../../../types/admin";
import { pickName } from "../../../../lib/person-name";

/**
 * The record with every name in the interface's script: the record keeps names
 * as text, in Arabic and — when the person has it — in Latin script beside it.
 * Students keep both, since their row shows one under the other.
 */
export function localizeRecord(r: YearRecord, lang: string): YearRecord {
  const pick = (name: string, latin?: string | null) => pickName(name, latin, lang);
  const committee = <D extends YearDefense>(d: D): D => ({ ...d, committee: d.committee.map((c) => ({ ...c, name: pick(c.name, c.latinName) })) });
  return {
    ...r,
    supervisors: r.supervisors.map((s) => ({ ...s, name: pick(s.name, s.latinName) })),
    topics: r.topics.map((x) => ({ ...x, supervisor: { ...x.supervisor, name: pick(x.supervisor.name, x.supervisor.latinName) } })),
    projects: r.projects.map((p) => ({
      ...p,
      supervisor: { ...p.supervisor, name: pick(p.supervisor.name, p.supervisor.latinName) },
      members: p.members.map((m) => ({ ...m, name: pick(m.name, m.latinName) })),
      defense: p.defense && committee(p.defense),
    })),
    defenses: r.defenses.map((d) => ({
      ...committee(d),
      students: d.students.map((n, i) => pick(n, d.studentsLatin?.[i])),
      supervisor: pick(d.supervisor, d.supervisorLatin),
    })),
  };
}

/** "2025/2026" → "2026/2027"; anything else gets no guess. */
export function nextYearTitle(title: string) {
  const m = /^(\d{4})\/(\d{4})$/.exec(title.trim());
  if (!m) return "";
  return `${Number(m[1]) + 1}/${Number(m[2]) + 1}`;
}

/** Case- and diacritic-blind match of a query against any of the fields. */
export function matches(q: string, ...fields: (string | null | undefined)[]) {
  if (!q) return true;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[ً-ٰٟ̀-ͯ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه");
  const needle = norm(q.trim());
  return fields.some((f) => !!f && norm(f).includes(needle));
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** The mentions from the best down, each with its colour in both themes. */
export const MENTIONS: { key: Mention; stroke: string; bar: string; chip: string; dot: string }[] = [
  {
    key: "excellent",
    stroke: "stroke-emerald-500",
    bar: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    key: "veryGood",
    stroke: "stroke-sky-500",
    bar: "bg-sky-500",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  {
    key: "good",
    stroke: "stroke-violet-500",
    bar: "bg-violet-500",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  {
    key: "fair",
    stroke: "stroke-amber-500",
    bar: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    key: "fail",
    stroke: "stroke-rose-500",
    bar: "bg-rose-500",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    dot: "bg-rose-500",
  },
];

export const mentionChip = (m?: Mention | null) => MENTIONS.find((x) => x.key === m)?.chip ?? "";

export const TOPIC_STATUS_ORDER = ["open", "full", "approved", "pending", "rejected", "archived"] as const;
export const TOPIC_STATUS_BAR: Record<string, string> = {
  open: "bg-sky-500",
  full: "bg-violet-500",
  approved: "bg-emerald-500",
  pending: "bg-amber-500",
  rejected: "bg-rose-500",
  archived: "bg-gray-400",
};

/** Month buckets for a list sorted by date: "2026-9" → its items. */
export function byMonth<T extends { date: string }>(items: T[]) {
  const out: { key: string; date: string; items: T[] }[] = [];
  for (const it of items) {
    const d = new Date(it.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const last = out[out.length - 1];
    if (last?.key === key) last.items.push(it);
    else out.push({ key, date: it.date, items: [it] });
  }
  return out;
}
