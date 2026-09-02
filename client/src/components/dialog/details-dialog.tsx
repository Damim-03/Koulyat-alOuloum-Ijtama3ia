import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface DetailRow {
  label: string;
  value: ReactNode;
  /** Force LTR for emails, numbers, ids, etc. */
  dir?: "ltr";
  /** Optional row icon (a lucide component, e.g. `Mail`). */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Span both columns on wide screens. */
  full?: boolean;
}

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  rows: DetailRow[];
  onClose: () => void;
  /** Optional header icon chip. */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Optional footer content (extra action buttons). */
  actions?: ReactNode;
  /** Lay rows out in one or two columns. Default: 2. */
  columns?: 1 | 2;
}

export function DetailsDialog({
  open,
  title,
  subtitle,
  rows,
  onClose,
  icon: Icon,
  actions,
  columns = 2,
}: Props) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
      />
      <div className="animate-[fadeIn_0.15s_ease-out] relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 bg-linear-to-l from-forest to-forest-deep px-6 py-4 text-cream">
          {Icon && (
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-cream/15">
              <Icon size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-base font-bold">{title}</h3>
            {subtitle && (
              <p className="truncate text-[11px] text-cream/70">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="max-h-[calc(90vh-8.5rem)] overflow-y-auto px-6 py-5">
          <div
            className={
              columns === 2
                ? "grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2"
                : "grid grid-cols-1 gap-4"
            }
          >
            {rows.map((row, i) => {
              const RowIcon = row.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 ${row.full ? "sm:col-span-2" : ""}`}
                >
                  {RowIcon && (
                    <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-forest/5 text-forest">
                      <RowIcon size={15} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-clay">
                      {row.label}
                    </p>
                    <div
                      className="text-sm font-semibold text-forest"
                      dir={row.dir}
                    >
                      {row.value === "" ||
                      row.value === null ||
                      row.value === undefined
                        ? "\u2014"
                        : row.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t border-forest/10 px-6 py-4">
          {actions}
          <button
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >{t("admin.close")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
