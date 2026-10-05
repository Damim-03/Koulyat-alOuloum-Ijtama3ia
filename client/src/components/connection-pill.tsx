import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, RotateCcw, SignalLow, Unplug, WifiOff, type LucideIcon } from "lucide-react";
import { checkConnection, useConnection } from "../lib/connection/connection";
import { useConnectionWatch } from "../hooks/use-network-status";
import { secondsUntil, useNow } from "../hooks/use-now";
import { playCue, preloadCues } from "../lib/sound";

/**
 * The connection, said once for the whole app: a pill that drops in at the
 * top of whatever page is open while the server cannot be reached or the
 * device is offline — with the countdown to the next attempt and a way to try
 * at once — and turns green for a moment when the connection is back and the
 * pages have reloaded what they missed.
 *
 * It is dark in both themes, so its colours are fixed rather than tokens.
 */

type Shown = "offline" | "down" | "checking" | "restored" | "slow";

const RESTORED_MS = 3500;
const SLOW_MS = 5000;

const LOOK: Record<Shown, { icon: LucideIcon; ring: string; text: string; line: string; glow: string }> = {
  offline: { icon: WifiOff, ring: "#fb7185", text: "text-rose-200", line: "via-rose-400/70", glow: "shadow-[0_0_0_1px_rgba(251,113,133,0.25)]" },
  down: { icon: Unplug, ring: "#fb7185", text: "text-rose-200", line: "via-rose-400/70", glow: "shadow-[0_0_0_1px_rgba(251,113,133,0.25)]" },
  checking: { icon: Loader2, ring: "#d4b483", text: "text-gold-soft", line: "via-gold/70", glow: "shadow-[0_0_0_1px_rgba(212,180,131,0.25)]" },
  restored: { icon: CheckCircle2, ring: "#34d399", text: "text-emerald-200", line: "via-emerald-400/70", glow: "shadow-[0_0_0_1px_rgba(52,211,153,0.25)]" },
  slow: { icon: SignalLow, ring: "#fbbf24", text: "text-amber-200", line: "via-amber-400/70", glow: "shadow-[0_0_0_1px_rgba(251,191,36,0.25)]" },
};

const R = 19;
const CIRC = 2 * Math.PI * R;

function Pill() {
  const { t } = useTranslation();
  useConnectionWatch();
  const { link, nextAt, waitMs, restoredAt, slowAt } = useConnection();

  // Sounds on the turns only: never on opening the app.
  const prevLink = useRef(link);
  useEffect(() => {
    preloadCues("networkError", "networkRestored");
  }, []);
  useEffect(() => {
    const was = prevLink.current;
    prevLink.current = link;
    if (was === "ok" && (link === "down" || link === "offline")) playCue("networkError");
  }, [link]);
  useEffect(() => {
    if (restoredAt) playCue("networkRestored");
  }, [restoredAt]);

  const recent = (at: number | null, ms: number, now: number) => at !== null && now - at < ms;
  const now = useNow(link !== "ok" || restoredAt !== null || slowAt !== null);

  const shown: Shown | null =
    link === "offline"
      ? "offline"
      : link === "down"
        ? "down"
        : link === "checking"
          ? "checking"
          : recent(restoredAt, RESTORED_MS, now)
            ? "restored"
            : recent(slowAt, SLOW_MS, now)
              ? "slow"
              : null;

  // While it slides away it keeps the face it left with — the green "back" or
  // the amber "slow", the only two that end on their own.
  const view: Shown = shown ?? (slowAt !== null && (restoredAt ?? 0) < slowAt ? "slow" : "restored");
  const look = LOOK[view];
  const Icon = look.icon;
  const left = nextAt ? secondsUntil(nextAt, now) : null;
  const frac = view === "down" && nextAt && waitMs ? Math.min(1, Math.max(0, (nextAt - now) / waitMs)) : view === "checking" ? 0.25 : 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[2147483000] flex justify-center px-4" aria-live="polite">
      <div
        role="status"
        data-testid="connection-pill"
        data-state={shown ?? "hidden"}
        className={`relative flex w-full max-w-md items-center gap-3.5 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1a17]/92 p-3 pe-3.5 text-white shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${look.glow} ${
          shown ? "pointer-events-auto translate-y-0 opacity-100" : "-translate-y-8 opacity-0"
        }`}
      >
        <span className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent to-transparent ${look.line}`} />
        <span className="pointer-events-none absolute -top-10 -start-8 size-28 rounded-full bg-white/[0.04] blur-2xl" />

        {/* the icon inside a ring that empties until the next attempt */}
        <span className="relative grid size-11 shrink-0 place-items-center">
          <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
            <circle
              cx="22"
              cy="22"
              r={R}
              fill="none"
              stroke={look.ring}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - frac)}
              className={view === "checking" ? "origin-center motion-safe:animate-spin" : "transition-[stroke-dashoffset] duration-300 ease-linear"}
            />
          </svg>
          {(view === "down" || view === "offline") && <span className="absolute inset-1 rounded-full bg-rose-400/15 motion-safe:animate-ping" />}
          <Icon size={18} className={`relative ${look.text} ${view === "checking" ? "motion-safe:animate-spin" : ""}`} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-white/95">{t(`connection.title_${view}`)}</p>
          <p className="mt-0.5 truncate text-[12px] text-white/60 tabular-nums">
            {view === "down" && left !== null ? t("connection.sub_down", { s: left }) : t(`connection.sub_${view}`)}
          </p>
        </div>

        {(view === "down" || view === "offline") && (
          <button
            type="button"
            onClick={() => void checkConnection()}
            disabled={view === "offline"}
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-linear-to-l from-gold to-gold-soft px-3 py-1.5 text-[12px] font-bold text-forest-deep shadow-[0_8px_18px_-10px_rgba(193,150,90,0.9)] transition hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <RotateCcw size={13} className="transition-transform duration-500 group-hover:-rotate-180" />
            {t("connection.retryNow")}
          </button>
        )}
      </div>
    </div>
  );
}

export function ConnectionPill() {
  return createPortal(<Pill />, document.body);
}
