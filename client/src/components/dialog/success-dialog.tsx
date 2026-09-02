import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  /** Optional short summary lines shown under the message. */
  summary?: string[];
  /** Optional primary follow-up action, e.g. "عرض العنصر". */
  actionLabel?: string;
  onAction?: () => void;
  closeLabel?: string;
  /** Auto-close after N ms (e.g. 2500). Omit to keep it open. */
  autoCloseMs?: number;
  children?: ReactNode;
}

export function SuccessDialog({
  open,
  onClose,
  title,
  message,
  summary,
  actionLabel,
  onAction,
  closeLabel,
  autoCloseMs,
  children,
}: Props) {
  const { t } = useTranslation();
  const titleText = title ?? t("common.successTitle");
  const closeText = closeLabel ?? t("common.done");
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (autoCloseMs) timer = setTimeout(onClose, autoCloseMs);
    return () => {
      window.removeEventListener("keydown", h);
      if (timer) clearTimeout(timer);
    };
  }, [open, onClose, autoCloseMs]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
      />
      <div className="animate-[fadeIn_0.15s_ease-out] relative w-full max-w-sm overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-2xl">
        <button
          onClick={onClose}
          className="absolute left-3 top-3 grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
        >
          <X size={18} />
        </button>

        <div className="px-6 pb-6 pt-8 text-center">
          {/* success ring */}
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100">
            <div className="grid size-11 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.4)]">
              <Check size={24} strokeWidth={3} />
            </div>
          </div>

          <h3 className="mt-4 font-serif text-lg font-bold text-forest">
            {titleText}
          </h3>
          {message && (
            <p className="mt-1.5 text-sm leading-relaxed text-clay">
              {message}
            </p>
          )}

          {summary && summary.length > 0 && (
            <ul className="mt-4 space-y-1.5 rounded-xl bg-cream-2 p-3 text-start">
              {summary.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-forest"
                >
                  <CheckCircle2
                    size={14}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}

          {children}

          <div className="mt-6 flex justify-center gap-2">
            {actionLabel && onAction && (
              <button
                onClick={onAction}
                className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
              >
                {actionLabel}
              </button>
            )}
            <button
              onClick={onClose}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                actionLabel && onAction
                  ? "border border-forest/20 text-forest hover:bg-forest/5"
                  : "bg-forest text-cream hover:bg-forest-deep"
              }`}
            >
              {closeText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
