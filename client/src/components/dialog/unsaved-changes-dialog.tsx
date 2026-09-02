import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  /** Proceed and lose the changes. */
  onDiscard: () => void;
  /** Stay in the form. */
  onKeepEditing: () => void;
  title?: string;
  message?: string;
  discardLabel?: string;
  keepLabel?: string;
}

export function UnsavedChangesDialog({
  open,
  onDiscard,
  onKeepEditing,
  title,
  message,
  discardLabel,
  keepLabel,
}: Props) {
  const { t } = useTranslation();
  const titleText = title ?? t("common.unsavedTitle");
  const messageText = message ?? t("common.unsavedBody");
  const discardText = discardLabel ?? t("common.discardChanges");
  const keepText = keepLabel ?? t("common.keepEditing");
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onKeepEditing();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onKeepEditing]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onKeepEditing}
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
      />
      <div className="animate-[fadeIn_0.15s_ease-out] relative w-full max-w-sm overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-2xl">
        <div className="flex items-start gap-3 p-6">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-base font-bold text-forest">
              {titleText}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-clay">{messageText}</p>
          </div>
          <button
            onClick={onKeepEditing}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-forest/10 px-6 py-4">
          <button
            onClick={onKeepEditing}
            className="rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {keepText}
          </button>
          <button
            onClick={onDiscard}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            {discardText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Guards a form against losing unsaved changes.
 *
 * Usage:
 *   const isDirty = ...;                       // your own dirty check
 *   const guard = useUnsavedGuard(isDirty);
 *
 *   // instead of calling onClose()/navigate() directly:
 *   <button onClick={() => guard.attempt(onClose)}>إغلاق</button>
 *   <div onClick={() => guard.attempt(onClose)} className="backdrop" />
 *
 *   // render the dialog once:
 *   <UnsavedChangesDialog
 *     open={guard.promptOpen}
 *     onDiscard={guard.confirm}
 *     onKeepEditing={guard.cancel}
 *   />
 *
 * It also warns on browser/tab close while dirty.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useUnsavedGuard(dirty: boolean) {
  const [promptOpen, setPromptOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  // Native browser/tab-close warning while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Call this in place of your close/navigate action.
  const attempt = useCallback(
    (action: () => void) => {
      if (dirty) {
        pending.current = action;
        setPromptOpen(true);
      } else {
        action();
      }
    },
    [dirty],
  );

  const confirm = useCallback(() => {
    setPromptOpen(false);
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);

  const cancel = useCallback(() => {
    setPromptOpen(false);
    pending.current = null;
  }, []);

  return { promptOpen, attempt, confirm, cancel };
}
