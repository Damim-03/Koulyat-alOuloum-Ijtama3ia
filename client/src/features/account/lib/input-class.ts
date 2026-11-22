const INPUT =
  "h-12 w-full rounded-2xl border bg-cream-2 px-4 text-[14px] text-forest outline-none transition placeholder:text-clay/60 focus:border-gold focus:bg-cream-card focus:ring-4 focus:ring-gold/15";

/** The account forms' text input — red-edged when it holds an error. */
export const inputCls = (error?: string) =>
  `${INPUT} ${error ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/15" : "border-forest/12"}`;
