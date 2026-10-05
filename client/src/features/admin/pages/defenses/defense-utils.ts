import i18n from "../../../../i18n/i18n";

/**
 * What state a session is in, as the schedule needs to see it: a defence left
 * "scheduled" after its hour is not upcoming, it is overdue for an update; and
 * one whose hour has come is happening now. Shared by the schedule and the
 * details page so both read a session the same way.
 */
export type Phase = "scheduled" | "live" | "stale" | "completed" | "cancelled";

export function phaseOf(d: { status?: string; date: string; endsAt?: string; durationMinutes?: number }): Phase {
  if (d.status === "cancelled") return "cancelled";
  if (d.status === "completed") return "completed";
  const now = Date.now();
  const start = new Date(d.date).getTime();
  const end = d.endsAt ? new Date(d.endsAt).getTime() : start + (d.durationMinutes ?? 60) * 60_000;
  if (now >= start && now < end) return "live";
  if (now >= end) return "stale";
  return "scheduled";
}

export const PHASE = {
  scheduled: { rail: "bg-forest text-cream", chip: "bg-gold/15 text-gold", ring: "border-forest/10" },
  live: {
    rail: "bg-linear-to-b from-gold to-gold-soft text-forest-deep",
    chip: "bg-gold text-forest-deep",
    ring: "border-gold/60 ring-2 ring-gold/25",
  },
  stale: {
    rail: "bg-red-500/15 text-red-700 dark:text-red-300",
    chip: "bg-red-500/15 text-red-700 dark:text-red-300",
    ring: "border-red-300/60",
  },
  completed: {
    rail: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    ring: "border-emerald-400/30",
  },
  cancelled: { rail: "bg-forest/5 text-clay", chip: "bg-forest/10 text-clay", ring: "border-forest/10 opacity-80" },
} as const;

export const clock = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

export const ROLE_ORDER = ["president", "supervisor", "examiner"];

export const byRole = <T extends { role: string }>(list: T[]) =>
  [...list].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
