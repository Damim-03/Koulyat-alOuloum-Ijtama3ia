import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  /** Footer actions (submit / cancel buttons). */
  footer?: ReactNode;
}

/**
 * Shared admin modal shell — forest header + gold accent line + cream body.
 * Matches the platform's "add / edit" dialog design.
 */
export function FormDialog({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
}: FormDialogProps) {
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
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-cream-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="relative bg-forest px-6 py-5">
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

        {/* Body */}
        <div className="px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center gap-3 border-t border-forest/10 bg-cream-2 px-6 py-4">
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
  error,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-forest">
        {Icon && <Icon size={14} className="text-clay" />}
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

/** Shared input style. */
export const inputClass =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 placeholder:text-clay/50";