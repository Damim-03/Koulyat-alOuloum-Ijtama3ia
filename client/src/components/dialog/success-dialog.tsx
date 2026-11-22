import { useEffect } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertAction, AlertShell } from "./alert-shell";

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

/**
 * نافذة النجاح — بإطار التنبيهات المشترك، بنبرة النجاح: شعارٌ بعلامة الصحّ،
 * والملخّص سطوراً تحت الرسالة، وإغلاقٌ تلقائيّ إن طُلب.
 */
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
  useEffect(() => {
    if (!open || !autoCloseMs) return;
    const timer = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(timer);
  }, [open, onClose, autoCloseMs]);

  const action = actionLabel && onAction;
  return (
    <AlertShell
      open={open}
      tone="success"
      icon={Check}
      kicker={t("alert.kickerSuccess")}
      title={title ?? t("common.successTitle")}
      message={message}
      onClose={onClose}
      actions={
        <>
          {action && (
            <AlertAction tone="success" onClick={onAction}>
              {actionLabel}
            </AlertAction>
          )}
          <AlertAction tone="success" variant={action ? "ghost" : "primary"} onClick={onClose}>
            {closeLabel ?? t("common.done")}
          </AlertAction>
        </>
      }
    >
      {summary && summary.length > 0 && (
        <ul className="space-y-2 rounded-2xl border border-sage/20 bg-sage/6 p-4">
          {summary.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-forest">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sage" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {children}
    </AlertShell>
  );
}
