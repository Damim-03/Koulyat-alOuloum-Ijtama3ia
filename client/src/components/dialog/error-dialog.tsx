import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  ShieldAlert,
  Ban,
  WifiOff,
  ServerCrash,
  SearchX,
  ChevronDown,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import type { ReactNode } from "react";
import { playCue } from "../../lib/sound";
import { t as translate } from "i18next";
import { useTranslation } from "react-i18next";

/* Console-style timing: quick in with a touch of overshoot, quicker out. */
const EXIT_MS = 220;
const DWELL_MS = 7000;

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ErrorKind =
  | "validation"
  | "permission"
  | "conflict"
  | "notFound"
  | "network"
  | "server"
  | "unknown";

export interface ErrorInfo {
  kind: ErrorKind;
  /** Human title. If omitted, a default per-kind title is used. */
  title?: string;
  /** Human explanation of what went wrong. */
  message: string;
  /** What the user can do about it. */
  suggestion?: string;
  /** Raw/technical detail (status, server message, field errors…). */
  detail?: string;
}

/**
 * لكلّ نوعٍ نبرته: لونٌ يُعرف به قبل أن يُقرأ — الخطأ الذي يمنع أحمر،
 * والتصحيح المطلوب ذهبيّ، والاتصال أخضر هادئ، والمفقود بلون الطين.
 */
type Tone = { emblem: string; glow: string; text: string; wash: string; line: string };
const TONES: Record<"brick" | "gold" | "sage" | "clay", Tone> = {
  brick: {
    emblem: "from-[#d66a4f] to-[#8c301d] text-white",
    glow: "shadow-[0_12px_28px_-10px_rgba(168,68,45,0.8)]",
    text: "text-brick",
    wash: "from-brick/14",
    line: "from-brick via-[#d66a4f] to-brick",
  },
  gold: {
    emblem: "from-gold-soft to-gold text-[var(--t-brand-deep)]",
    glow: "shadow-[0_12px_28px_-10px_rgba(193,150,90,0.85)]",
    text: "text-gold",
    wash: "from-gold/16",
    line: "from-gold via-gold-soft to-gold",
  },
  sage: {
    emblem: "from-[#6fa394] to-[#3d6b5f] text-white",
    glow: "shadow-[0_12px_28px_-10px_rgba(74,112,102,0.85)]",
    text: "text-sage",
    wash: "from-sage/16",
    line: "from-sage via-soft-sage to-sage",
  },
  clay: {
    emblem: "from-[#8a8173] to-[#5a5348] text-white",
    glow: "shadow-[0_12px_28px_-10px_rgba(107,99,87,0.8)]",
    text: "text-clay",
    wash: "from-clay/14",
    line: "from-clay via-clay/60 to-clay",
  },
};

const META: Record<
  ErrorKind,
  {
    titleKey: string;
    suggestionKey: string;
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    tone: Tone;
  }
> = {
  validation: { titleKey: "errorDialog.validationTitle", suggestionKey: "errorDialog.validationBody", icon: AlertTriangle, tone: TONES.gold },
  permission: { titleKey: "errorDialog.permissionTitle", suggestionKey: "errorDialog.permissionBody", icon: ShieldAlert, tone: TONES.brick },
  conflict: { titleKey: "errorDialog.conflictTitle", suggestionKey: "errorDialog.conflictBody", icon: Ban, tone: TONES.brick },
  notFound: { titleKey: "errorDialog.notFoundTitle", suggestionKey: "errorDialog.notFoundBody", icon: SearchX, tone: TONES.clay },
  network: { titleKey: "errorDialog.networkTitle", suggestionKey: "errorDialog.networkBody", icon: WifiOff, tone: TONES.sage },
  server: { titleKey: "errorDialog.serverTitle", suggestionKey: "errorDialog.serverBody", icon: ServerCrash, tone: TONES.brick },
  unknown: { titleKey: "errorDialog.unknownTitle", suggestionKey: "errorDialog.unknownBody", icon: AlertTriangle, tone: TONES.brick },
};

interface Props {
  open: boolean;
  error: ErrorInfo | null;
  onClose: () => void;
  /** Optional retry handler; shows a t("errorDialog.retry") button when provided. */
  onRetry?: () => void;
  children?: ReactNode;
}

/**
 * بطاقة الخطأ — تنزلق من زاوية الشاشة كإشعار، ولا توقف العمل.
 *
 * وتُغلق وحدها بعد مدّةٍ يراها المستعمل: شريطٌ في أسفلها يتناقص، ويتوقّف ما
 * دام المؤشّر عليها — فالبطاقة التي تُقرأ لا تختفي من تحت العين. والشريط
 * نفسه هو المؤقّت (نهاية حركته تُغلقها)، فلا يفترق ما يُرى عمّا يحدث.
 */
export function ErrorDialog({
  open,
  error,
  onClose,
  onRetry,
  children,
}: Props) {
  const { t } = useTranslation();
  const [showDetail, setShowDetail] = useState(false);
  // Entry animates purely in CSS on mount; `leaving` only drives the exit,
  // which is always triggered by a user action or the dwell bar.
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  useEffect(() => {
    if (!open || !error) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeaving(false);
    setShowDetail(false);
    // A connection failure is the network cue; everything else is the
    // error-dialog cue.
    playCue(error.kind === "network" ? "networkError" : "errorDialog");

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, error, dismiss]);

  if (!open || !error) return null;

  const meta = META[error.kind] ?? META.unknown;
  const Icon = meta.icon;
  const tone = meta.tone;
  const title = error.title ?? t(meta.titleKey);
  const suggestion = error.suggestion ?? t(meta.suggestionKey);

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      /* Top-left, sliding in from off-screen like a console notification.
         Only transform/opacity animate, so it stays on the compositor. */
      className={`group fixed top-4 left-4 z-2147483647 w-[min(26rem,calc(100vw-2rem))] font-body will-change-[transform,opacity] ${
        leaving ? "toast-leave" : "toast-enter"
      }`}
    >
      <div className="relative overflow-hidden rounded-[22px] border border-gold/20 bg-cream-card shadow-[0_28px_70px_-18px_rgba(4,10,8,0.6)] ring-1 ring-black/5">
        <div aria-hidden className={`absolute inset-x-0 top-0 h-[3px] bg-linear-to-l ${tone.line}`} />
        <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b ${tone.wash} to-transparent`} />

        <div className="relative flex items-start gap-3.5 p-4 pt-5">
          <div aria-hidden className="relative grid size-12 shrink-0 place-items-center">
            <span className={`animate-halo absolute inset-0 rounded-2xl bg-linear-to-br opacity-40 ${tone.emblem}`} />
            <span className={`relative grid size-11 place-items-center rounded-2xl bg-linear-to-br ring-1 ring-white/20 ${tone.emblem} ${tone.glow}`}>
              <Icon size={21} strokeWidth={2.2} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[10.5px] font-bold tracking-[0.16em] ${tone.text}`}>{t("alert.kickerError")}</p>
            <h3 className="mt-0.5 font-serif text-[16px] leading-snug font-bold text-forest">{title}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-forest/85">{error.message}</p>
            {suggestion && (
              <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-cream-2 px-3 py-2 text-[12px] leading-relaxed text-clay ring-1 ring-forest/8">
                <Lightbulb size={14} className={`mt-0.5 shrink-0 ${tone.text}`} />
                {suggestion}
              </p>
            )}
            {children}

            {error.detail && (
              <div className="mt-2">
                <button
                  onClick={() => setShowDetail((s) => !s)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-clay transition hover:text-forest"
                >
                  <ChevronDown size={12} className={`transition ${showDetail ? "rotate-180" : ""}`} />
                  {t("errorDialog.technicalDetails")}
                </button>
                {showDetail && (
                  <pre
                    dir="ltr"
                    className="mt-1.5 max-h-32 overflow-auto rounded-lg bg-forest-deep/90 p-2.5 text-left text-[10px] leading-relaxed whitespace-pre-wrap text-cream/90"
                  >
                    {error.detail}
                  </pre>
                )}
              </div>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label={t("admin.close")}
            className="grid size-8 shrink-0 place-items-center rounded-xl text-clay ring-1 ring-forest/10 transition hover:bg-forest/5 hover:text-forest"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative flex justify-end gap-2 border-t border-forest/8 bg-cream-2/60 px-4 py-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 bg-cream-card px-3.5 py-2 text-xs font-bold text-forest transition hover:bg-forest/5"
            >
              <RefreshCw size={13} />
              {t("errorDialog.retry")}
            </button>
          )}
          <button
            onClick={dismiss}
            className="rounded-xl bg-linear-to-b from-[#34574e] to-[#1a312d] px-5 py-2 text-xs font-bold text-[#f5edda] shadow-[0_8px_18px_-8px_rgba(26,49,45,0.9)] transition hover:brightness-115"
          >
            {t("errorDialog.ok")}
          </button>
        </div>

        {/* المدّة الباقية — تتوقّف ما دام المؤشّر على البطاقة، وبنهايتها تُغلق. */}
        <div className="h-1 bg-forest/6">
          <div
            key={`${error.kind}|${error.message}`}
            onAnimationEnd={dismiss}
            style={{ animationDuration: `${DWELL_MS}ms` }}
            className={`animate-dwell h-full bg-linear-to-l ${tone.line} group-hover:[animation-play-state:paused] ltr:origin-left rtl:origin-right`}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Turns an Axios-style error into a classified ErrorInfo.
 * Reads HTTP status + your API's { message, errorCode } body.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function toErrorInfo(err: any): ErrorInfo {
  // No response → network / offline.
  if (err && err.request && !err.response) {
    return {
      kind: "network",
      message: translate("errorDialog.serverUnreachable"),
      detail: err.message,
    };
  }

  const status: number | undefined = err?.response?.status;
  const data = err?.response?.data ?? {};
  const serverMsg: string | undefined =
    data.message || data.error || err?.message;
  const code: string | undefined = data.errorCode;

  // Field errors (e.g. "Validation error → email: Invalid email"). And the
  // server's own words, when another language replaced them on screen.
  const detail = [
    code && `code: ${code}`,
    status && `status: ${status}`,
    data.originalMessage ?? serverMsg,
  ]
    .filter(Boolean)
    .join("\n");

  let kind: ErrorKind = "unknown";
  if (status === 400 || status === 422 || code === "VALIDATION_ERROR")
    kind = "validation";
  else if (status === 401 || status === 403) kind = "permission";
  else if (status === 404 || code === "RESOURCE_NOT_FOUND") kind = "notFound";
  else if (status === 409) kind = "conflict";
  else if (status && status >= 500) kind = "server";

  return {
    kind,
    // The server's message — already in the interface language (lib/api/localize) —
    // else a per-kind default.
    message: serverMsg || translate(META[kind].titleKey),
    detail: detail || undefined,
  };
}
