/**
 * One colour per status — the ones the dashboard's topic breakdown uses —
 * at low alpha, so a badge reads in both themes. `StatusBadge` fills with
 * the palette's -100 shades, which glare on the dark ground.
 *
 * Covers topic statuses and a group request's `accepted`.
 */
export const STATUS_TONE: Record<string, { dot: string; pill: string }> = {
  pending: { dot: "bg-amber-400", pill: "bg-amber-400/15 text-amber-500 ring-amber-400/30" },
  approved: { dot: "bg-sky-400", pill: "bg-sky-400/15 text-sky-500 ring-sky-400/30" },
  open: { dot: "bg-emerald-400", pill: "bg-emerald-400/15 text-emerald-500 ring-emerald-400/30" },
  full: { dot: "bg-violet-400", pill: "bg-violet-400/15 text-violet-500 ring-violet-400/30" },
  accepted: { dot: "bg-sage", pill: "bg-sage/15 text-sage ring-sage/30" },
  rejected: { dot: "bg-brick", pill: "bg-brick/10 text-brick ring-brick/25" },
  archived: { dot: "bg-clay", pill: "bg-forest/8 text-clay ring-forest/15" },
};
