import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "../../../../hooks/use-body-scroll-lock";
import type { LucideIcon } from "lucide-react";

/** Panel width. "md" is the historical default — keep it for narrow forms. */
export type FormDialogSize = "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_CLASS: Record<FormDialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
};

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  /** Footer actions (submit / cancel buttons). */
  footer?: ReactNode;
  /** Panel width. Wide forms use "xl" so every field fits without scrolling. */
  size?: FormDialogSize;
  /** Where the footer actions sit. Forms keep them at the start; dialogs that
   *  only offer a choice read better with them centred. */
  footerAlign?: "start" | "center";
}

/**
 * Shared admin modal shell — forest header + gold accent line + cream body.
 * Matches the platform's "add / edit" dialog design.
 *
 * The panel is a flex column capped at 92vh: the header and footer stay put
 * and only the body scrolls, so a tall form can never push the submit buttons
 * off-screen on a short viewport.
 */
export function FormDialog({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  size = "md",
  footerAlign = "start",
}: FormDialogProps) {
  useBodyScrollLock(open);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-forest-deep/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={`relative z-10 flex max-h-[92vh] w-full ${SIZE_CLASS[size]} flex-col overflow-hidden rounded-2xl bg-cream-card shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0 bg-forest px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="grid size-11 place-items-center rounded-full bg-cream/15 text-cream">
                  <Icon size={20} />
                </div>
              )}
              <div>
                <h2 className="font-serif text-lg font-bold text-cream">{title}</h2>
                {subtitle && <p className="text-xs text-cream/70">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-cream/80 transition hover:bg-cream/15 hover:text-cream"
            >
              <X size={18} />
            </button>
          </div>
          {/* Gold accent line */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </div>

        {/* Body — the only scrollable region (min-h-0 lets it actually shrink) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={`flex shrink-0 items-center gap-3 border-t border-forest/10 bg-cream-2 px-6 py-4 ${
              footerAlign === "center" ? "justify-center" : ""
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A labeled field wrapper — icon + label above the control. */
export function Field({
  label,
  icon: Icon,
  note,
  hint,
  error,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  /** Short qualifier beside the label, e.g. "optional". */
  note?: string;
  /** One line under the control explaining what the value is used for. */
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-forest">
        {Icon && <Icon size={14} className="text-clay" />}
        {label}
        {note && (
          <span className="text-[10px] font-normal text-clay/80">({note})</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[11px] leading-relaxed text-clay/80">{hint}</p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

/**
 * A titled group of fields. Wide dialogs use these to keep a long form
 * scannable instead of one undifferentiated column of inputs.
 */
export function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-forest/10 bg-cream-2/60 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-forest">
        {Icon && <Icon size={16} className="text-gold" />}
        {title}
        <span className="h-px flex-1 bg-forest/10" />
      </h3>
      {children}
    </section>
  );
}

/** Shared input style. */
export const inputClass =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 placeholder:text-clay/50";