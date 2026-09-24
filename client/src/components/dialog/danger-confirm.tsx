import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Ban, Trash2, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

/** سطرٌ في بطاقة المحذوف: ما يعرّفه. */
export interface DangerFact {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  /** أرقامٌ وبريدٌ ومعرّفات — تُقرأ من اليسار. */
  dir?: "ltr";
}

/** سطرٌ في قائمة «سيُحذف معه». */
export interface DangerImpact {
  icon: LucideIcon;
  label: string;
  /** عددٌ إن كان معلوماً؛ ويُترك فارغاً حين لا عدد. */
  value?: ReactNode;
  /** سطرٌ ثانٍ يسمّي المعنيّ بالاسم — عنوانُ المشروع مثلاً. */
  detail?: ReactNode;
  /** أثرٌ ثقيل — مشروعٌ قائم أو مجموعةٌ مشكَّلة — فيُبرز بلون الخطر. */
  heavy?: boolean;
}

/** مانعٌ يقفُ دون الحذف: يُعرض قبل الضغط لا بعد ردّ الخادم. */
export interface DangerBlock {
  message: string;
  /** ما يُفعل أوّلاً ليزول المانع. */
  hint?: string;
}

/**
 * تأكيدُ حذفٍ يُري ما سيُحذف.
 *
 * التأكيد القديم كان سطراً واحداً: «هل أنت متأكّد من حذف فلان؟ لا يمكن
 * التراجع». والاسمُ وحده لا يكفي لقرارٍ لا رجعة فيه: الإدارية تفتح الصفحة
 * من قائمةٍ فيها متشابهو الأسماء، وما يذهب مع الحساب — طلباتُ المجموعة
 * وعضويةُ المشروع والملفّات المرفوعة — لا يظهر في أيّ مكان قبل أن يذهب.
 *
 * فصار للنافذة ثلاثة أقسام: **بطاقةٌ** تقول مَن هذا بالضبط، و**قائمةٌ**
 * تقول ما الذي يسقط معه، و**مانعٌ** — إن وُجد — يقول لماذا لا يُحذف الآن
 * وما يُفعل أوّلاً.
 *
 * والمانع هو الفرق العمليّ الأكبر: الخادم يرفض حذف أستاذٍ له مواضيع، ويرفض
 * حذف حسابٍ هو طالبٌ أو أستاذ. وكان ذلك يُعرف بعد الضغط، من رسالة خطأٍ
 * حمراء؛ وصار يُعرف قبله، والزرّ نفسه معطَّل.
 */
export function DangerConfirm({
  open,
  onClose,
  onConfirm,
  loading = false,
  title,
  icon: Icon = Trash2,
  name,
  kicker,
  avatar,
  facts = [],
  impacts = [],
  block,
  warning,
  confirmLabel,
  cancelLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title: string;
  icon?: LucideIcon;
  /** اسم المحذوف أو عنوانه. */
  name: string;
  /** صفتُه بكلمة: طالب، أستاذ، موضوع. */
  kicker?: string;
  /** صورةٌ أو أيقونةٌ في صدر البطاقة. */
  avatar?: ReactNode;
  facts?: DangerFact[];
  impacts?: DangerImpact[];
  block?: DangerBlock | null;
  /** سطر «لا يمكن التراجع» — يُمرَّر لأنّ صيغته تختلف بين الكيانات. */
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** إضافةٌ تحت القائمة — حقل سببٍ مثلاً. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  // التركيز يبدأ على «إلغاء» لا على «حذف»: مسافةٌ أو Enter في لحظة سهوٍ
  // تُنفّذ الزرّ المركَّز، وأخفُّ الاحتمالين أن يكون الإلغاء.
  useEffect(() => {
    if (open) cancelRef.current?.focus?.();
  }, [open]);

  if (!open) return null;

  const blocked = !!block;

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={() => !loading && onClose()}
        className="absolute inset-0 bg-forest-deep/50 backdrop-blur-sm"
      />

      <div className="animate-[fadeIn_0.15s_ease-out] relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brick/20 bg-cream-card shadow-2xl">
        {/* ── رأسٌ بلون الإجراء، فلا يُخلط بنافذة حفظ ── */}
        <div className="flex items-center gap-3 border-b border-brick/15 bg-brick/8 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brick/15 text-brick">
            <Icon size={19} />
          </span>
          <h3 className="min-w-0 flex-1 font-serif text-base font-bold text-forest">
            {title}
          </h3>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            aria-label={t("pro.cancel")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* ── بطاقة المحذوف ── */}
          <div className="flex items-start gap-3 rounded-xl border border-forest/12 bg-cream-2 p-3">
            {avatar && <div className="shrink-0">{avatar}</div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 font-serif text-base font-bold text-forest">
                  {name}
                </p>
                {kicker && (
                  <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-semibold text-clay">
                    {kicker}
                  </span>
                )}
              </div>

              {facts.length > 0 && (
                <dl className="mt-2.5 grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
                  {facts.map((f) => (
                    <div key={f.label} className="flex items-center gap-1.5">
                      <f.icon size={12} className="shrink-0 text-clay/70" />
                      <dt className="shrink-0 text-[11px] text-clay/80">
                        {f.label}
                      </dt>
                      <dd
                        dir={f.dir}
                        className="min-w-0 truncate text-[12px] font-semibold text-forest"
                      >
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>

          {/* ── المانع، إن وُجد ── */}
          {block && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-brick/30 bg-brick/8 p-3">
              <Ban size={16} className="mt-0.5 shrink-0 text-brick" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brick">
                  {block.message}
                </p>
                {block.hint && (
                  <p className="mt-1 text-[12px] leading-relaxed text-clay">
                    {block.hint}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── ما يسقط مع المحذوف ── */}
          {!blocked && impacts.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-[11px] font-bold text-clay">
                {t("admin.deletedAlongWith")}
              </p>
              <ul className="space-y-1.5">
                {impacts.map((im) => (
                  <li
                    key={im.label}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                      im.heavy
                        ? "border-brick/25 bg-brick/8 text-brick"
                        : "border-forest/10 bg-cream-2/60 text-clay"
                    }`}
                  >
                    <im.icon
                      size={14}
                      className={`mt-0.5 shrink-0 self-start ${im.heavy ? "text-brick" : "text-clay/70"}`}
                    />
                    <span className="min-w-0 flex-1">
                      {im.label}
                      {im.detail && (
                        <span className="mt-0.5 block truncate text-[11px] text-clay/75">
                          {im.detail}
                        </span>
                      )}
                    </span>
                    {im.value !== undefined && (
                      <span
                        dir="ltr"
                        className={`mt-0.5 shrink-0 self-start rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          im.heavy
                            ? "bg-brick/15 text-brick"
                            : "bg-forest/8 text-forest"
                        }`}
                      >
                        {im.value}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {children && <div className="mt-4">{children}</div>}

          {!blocked && warning && (
            <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-brick">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {warning}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-forest/10 bg-cream-2/40 px-5 py-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
          >
            {cancelLabel ?? t("pro.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || blocked}
            title={blocked ? block?.message : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-brick px-5 py-2.5 text-sm font-semibold text-cream transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon size={16} />
            {loading ? "…" : (confirmLabel ?? t("admin.deletePermanently"))}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
