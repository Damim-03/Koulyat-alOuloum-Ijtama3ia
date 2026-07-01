import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * A polished, accessible confirm/delete modal to replace window.confirm().
 * Renders in a portal, closes on Escape / backdrop click.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  tone = "default",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const danger = tone === "danger";

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* backdrop */}
      <div
        onClick={() => !loading && onClose()}
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
      />

      {/* card */}
      <div className="animate-[fadeIn_0.15s_ease-out] relative w-full max-w-md overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-2xl">
        <button
          onClick={() => !loading && onClose()}
          className="absolute left-4 top-4 grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
        >
          <X size={16} />
        </button>

        <div className="px-6 pb-6 pt-8 text-center">
          <div
            className={`mx-auto mb-4 grid size-14 place-items-center rounded-full ${
              danger ? "bg-red-100 text-red-500" : "bg-gold/15 text-gold"
            }`}
          >
            <AlertTriangle size={26} />
          </div>
          <h3 className="font-serif text-lg font-bold text-forest">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-clay">{message}</p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-cream transition disabled:opacity-60 ${
                danger
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-forest hover:bg-forest-deep"
              }`}
            >
              {loading ? "..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
