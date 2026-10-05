import { useEffect, useState } from "react";

/** The current time, re-read every `stepMs` while `active` — for countdowns. */
export function useNow(active: boolean, stepMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(id);
  }, [active, stepMs]);
  return now;
}

/** Whole seconds left until `at` (never below 1 while it is still ahead). */
export const secondsUntil = (at: number, now: number) => Math.max(1, Math.ceil((at - now) / 1000));
