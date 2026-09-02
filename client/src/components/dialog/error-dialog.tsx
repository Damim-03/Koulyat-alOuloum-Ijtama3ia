import { useCallback, useEffect, useRef, useState } from "react";
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

const META: Record<
  ErrorKind,
  {
    titleKey: string;
    suggestionKey: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tint: string; // icon chip
    accent: string; // left accent + button
  }
> = {
  validation: {
    titleKey: "errorDialog.validationTitle",
    suggestionKey: "errorDialog.validationBody",
    icon: AlertTriangle,
    tint: "bg-amber-100 text-amber-600",
    accent: "border-amber-400",
  },
  permission: {
    titleKey: "errorDialog.permissionTitle",
    suggestionKey: "errorDialog.permissionBody",
    icon: ShieldAlert,
    tint: "bg-red-100 text-red-500",
    accent: "border-red-400",
  },
  conflict: {
    titleKey: "errorDialog.conflictTitle",
    suggestionKey: "errorDialog.conflictBody",
    icon: Ban,
    tint: "bg-orange-100 text-orange-600",
    accent: "border-orange-400",
  },
  notFound: {
    titleKey: "errorDialog.notFoundTitle",
    suggestionKey: "errorDialog.notFoundBody",
    icon: SearchX,
    tint: "bg-clay/15 text-clay",
    accent: "border-clay",
  },
  network: {
    titleKey: "errorDialog.networkTitle",
    suggestionKey: "errorDialog.networkBody",
    icon: WifiOff,
    tint: "bg-sky-100 text-sky-600",
    accent: "border-sky-400",
  },
  server: {
    titleKey: "errorDialog.serverTitle",
    suggestionKey: "errorDialog.serverBody",
    icon: ServerCrash,
    tint: "bg-red-100 text-red-500",
    accent: "border-red-400",
  },
  unknown: {
    titleKey: "errorDialog.unknownTitle",
    suggestionKey: "errorDialog.unknownBody",
    icon: AlertTriangle,
    tint: "bg-red-100 text-red-500",
    accent: "border-red-400",
  },
};

interface Props {
  open: boolean;
  error: ErrorInfo | null;
  onClose: () => void;
  /** Optional retry handler; shows a t("errorDialog.retry") button when provided. */
  onRetry?: () => void;
  children?: ReactNode;
}

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
  // which is always triggered by a user action or the dwell timer.
  const [leaving, setLeaving] = useState(false);
  const hovering = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const tick = () => {
      timer.current = window.setTimeout(() => {
        if (hovering.current) return tick(); // hold while pointed at
        dismiss();
      }, DWELL_MS);
    };
    tick();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, error, dismiss]);

  if (!open || !error) return null;

  const meta = META[error.kind] ?? META.unknown;
  const Icon = meta.icon;
  const title = error.title ?? t(meta.titleKey);
  const suggestion = error.suggestion ?? t(meta.suggestionKey);

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      /* Top-left, sliding in from off-screen like a console notification.
         Only transform/opacity animate, so it stays on the compositor. */
      className={`fixed top-4 left-4 z-2147483647 w-[min(24rem,calc(100vw-2rem))] will-change-[transform,opacity] ${
        leaving ? "toast-leave" : "toast-enter"
      }`}
    >
      <div
        className={`overflow-hidden rounded-2xl border border-forest/10 border-r-4 ${meta.accent} bg-cream-card shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-sm`}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={`grid size-9 shrink-0 place-items-center rounded-full ${meta.tint}`}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-sm font-bold text-forest">
              {title}
            </h3>
            <p className="mt-0.5 text-[13px] leading-relaxed text-forest/90">
              {error.message}
            </p>
            {suggestion && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-clay">
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
                  <ChevronDown
                    size={12}
                    className={`transition ${showDetail ? "rotate-180" : ""}`}
                  />{t("errorDialog.technicalDetails")}</button>
                {showDetail && (
                  <pre
                    dir="ltr"
                    className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-forest-deep/90 p-2.5 text-left text-[10px] leading-relaxed text-cream/90"
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
            className="grid size-7 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex justify-end gap-2 border-t border-forest/10 px-4 py-2.5">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/5"
              >
                <RefreshCw size={13} />{t("errorDialog.retry")}</button>
            )}
            <button
              onClick={dismiss}
              className="rounded-lg bg-forest px-4 py-1.5 text-xs font-semibold text-cream transition hover:bg-forest-deep"
          >{t("errorDialog.ok")}</button>
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

  // Field errors (e.g. "Validation error → email: Invalid email").
  const detail = [
    code && `code: ${code}`,
    status && `status: ${status}`,
    serverMsg,
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
    // Prefer the server's Arabic message when present, else a per-kind default.
    message: serverMsg || translate(META[kind].titleKey),
    detail: detail || undefined,
  };
}
