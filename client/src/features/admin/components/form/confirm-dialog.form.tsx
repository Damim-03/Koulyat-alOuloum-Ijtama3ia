import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Check, ShieldQuestion, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AlertAction, AlertShell } from "../../../../components/dialog/alert-shell";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  loading?: boolean;
  /** أيقونة الفعل في شعار النافذة — سلّة للحذف، علامةٌ للرفض… */
  icon?: LucideIcon;
  /** سطرٌ صغير فوق العنوان؛ وإن غاب فبحسب النبرة. */
  kicker?: string;
  /** Optional extra content under the message — e.g. a reason field. */
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * نافذة التأكيد بدل `window.confirm()` — بإطار التنبيهات المشترك (AlertShell):
 * شعارٌ بأيقونة الفعل، وما بين «…» في الرسالة مبرَزاً، وزرّان بعرضٍ واحد.
 *
 * وفي الخطر يبدأ التركيز على «إلغاء» لا على الفعل: مسافةٌ أو Enter في لحظة
 * سهوٍ تُنفّذ الزرّ المركَّز، وأخفّ الاحتمالين أن يكون الإلغاء.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "default",
  loading = false,
  icon,
  kicker,
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const danger = tone === "danger";
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && danger) cancelRef.current?.focus?.();
  }, [open, danger]);

  const shellTone = danger ? "danger" : "warning";
  return (
    <AlertShell
      open={open}
      tone={shellTone}
      icon={icon ?? (danger ? AlertTriangle : ShieldQuestion)}
      kicker={kicker ?? (danger ? t("alert.kickerDanger") : t("alert.kickerConfirm"))}
      title={title}
      message={message}
      onClose={onClose}
      busy={loading}
      actions={
        <>
          <AlertAction ref={cancelRef} variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t("pro.cancel")}
          </AlertAction>
          <AlertAction
            tone={shellTone}
            onClick={onConfirm}
            loading={loading}
            icon={icon ?? (danger ? undefined : Check)}
            testid="confirm-dialog-confirm"
          >
            {confirmLabel ?? t("admin.confirm")}
          </AlertAction>
        </>
      }
    >
      {children}
    </AlertShell>
  );
}
