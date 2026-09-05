/**
 * Status chip colours, shared by every admin list.
 *
 * These were written per page as light-only pastels (`bg-emerald-100
 * text-emerald-700`), which turn into bright patches on a dark table because a
 * fixed palette value does not follow the theme. Each entry now carries a dark
 * counterpart: a translucent tint of the same hue plus a light-on-dark text
 * shade, so the chip keeps its meaning in both themes.
 */
export const STATUS_CHIP: Record<string, string> = {
  // topics
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  open: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  full: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  archived: "bg-gray-200 text-gray-600 dark:bg-gray-400/15 dark:text-gray-300",
  // requests / projects reuse the same vocabulary
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  cancelled: "bg-gray-200 text-gray-600 dark:bg-gray-400/15 dark:text-gray-300",
};

export const STATUS_CHIP_FALLBACK =
  "bg-gray-100 text-gray-600 dark:bg-gray-400/15 dark:text-gray-300";

export function statusChip(status?: string | null) {
  return (status && STATUS_CHIP[status]) || STATUS_CHIP_FALLBACK;
}
