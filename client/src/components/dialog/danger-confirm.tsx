import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Ban, ChevronLeft, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AlertAction, AlertShell } from "./alert-shell";

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
  impactsTitle,
  impactsAlways = false,
  trail = [],
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
  /** عنوان القائمة — «سيُحذف معه» إن غاب. */
  impactsTitle?: string;
  /** القائمة ظاهرةٌ ولو مُنع الحذف — حين تكون هي سبب المنع. */
  impactsAlways?: boolean;
  /** موقعه في الهيكل، من الأعلى إليه: الكلية › القسم › الشعبة… */
  trail?: string[];
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

  // التركيز يبدأ على «إلغاء» لا على «حذف»: مسافةٌ أو Enter في لحظة سهوٍ
  // تُنفّذ الزرّ المركَّز، وأخفُّ الاحتمالين أن يكون الإلغاء.
  useEffect(() => {
    if (open) cancelRef.current?.focus?.();
  }, [open]);

  const blocked = !!block;

  return (
    <AlertShell
      open={open}
      tone="danger"
      icon={Icon}
      kicker={blocked ? t("alert.kickerBlocked") : t("alert.kickerDanger")}
      title={title}
      onClose={onClose}
      busy={loading}
      size="lg"
      actions={
        <>
          <AlertAction ref={cancelRef} variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t("pro.cancel")}
          </AlertAction>
          <AlertAction
            tone="danger"
            icon={Icon}
            onClick={onConfirm}
            loading={loading}
            disabled={blocked}
            title={blocked ? block?.message : undefined}
          >
            {confirmLabel ?? t("admin.deletePermanently")}
          </AlertAction>
        </>
      }
    >
      {/* ── بطاقة المحذوف: مَن هذا بالضبط ── */}
      <div className="relative overflow-hidden rounded-2xl border border-brick/20 bg-cream-2 p-4 shadow-[0_10px_30px_-22px_rgba(168,68,45,0.8)]">
        <div aria-hidden className="absolute inset-y-0 start-0 w-1 bg-linear-to-b from-brick/70 to-brick/20" />
        <div className="flex items-start gap-3">
          {avatar && <div className="shrink-0">{avatar}</div>}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 font-serif text-lg font-bold text-forest">{name}</p>
              {kicker && (
                <span className="rounded-full bg-brick/10 px-2.5 py-0.5 text-[11px] font-bold text-brick ring-1 ring-brick/20">
                  {kicker}
                </span>
              )}
            </div>

            {trail.length > 0 && (
              <ol className="mt-2 flex flex-wrap items-center gap-1 text-[12px] text-clay" aria-label={t("alert.trail")}>
                {trail.map((step, i) => (
                  <li key={`${i}-${step}`} className="flex items-center gap-1">
                    {i > 0 && <ChevronLeft size={13} className="shrink-0 text-gold ltr:rotate-180" />}
                    <span className="rounded-md bg-forest/6 px-1.5 py-0.5 font-semibold text-forest/80">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {facts.length > 0 && (
              <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5">
                    <f.icon size={13} className="shrink-0 text-clay/70" />
                    <dt className="shrink-0 text-[11.5px] text-clay/80">{f.label}</dt>
                    <dd dir={f.dir} className="min-w-0 truncate text-[12.5px] font-semibold text-forest">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>

      {/* ── المانع، إن وُجد: لماذا لا يُحذف الآن، وما يُفعل أوّلاً ── */}
      {block && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-brick/30 bg-brick/8 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brick/15 text-brick">
            <Ban size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-brick">{block.message}</p>
            {block.hint && <p className="mt-1 text-[12.5px] leading-relaxed text-clay">{block.hint}</p>}
          </div>
        </div>
      )}

      {/* ── ما يسقط مع المحذوف ── */}
      {(!blocked || impactsAlways) && impacts.length > 0 && (
        <>
          <p className="mt-5 mb-2 flex items-center gap-2 text-[11.5px] font-bold text-clay">
            <span className="h-px flex-1 bg-forest/10" />
            {impactsTitle ?? t("admin.deletedAlongWith")}
            <span className="h-px flex-1 bg-forest/10" />
          </p>
          <ul className="space-y-1.5">
            {impacts.map((im) => (
              <li
                key={im.label}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] ${
                  im.heavy ? "border-brick/25 bg-brick/8 text-brick" : "border-forest/10 bg-cream-2/60 text-clay"
                }`}
              >
                <im.icon
                  size={15}
                  className={`mt-0.5 shrink-0 self-start ${im.heavy ? "text-brick" : "text-clay/70"}`}
                />
                <span className="min-w-0 flex-1">
                  {im.label}
                  {im.detail && <span className="mt-0.5 block truncate text-[11px] text-clay/75">{im.detail}</span>}
                </span>
                {im.value !== undefined && (
                  <span
                    dir="ltr"
                    className={`mt-0.5 shrink-0 self-start rounded-full px-2.5 py-0.5 font-serif text-[12px] font-bold ${
                      im.heavy ? "bg-brick/15 text-brick" : "bg-forest/8 text-forest"
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
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-brick/6 px-3 py-2.5 text-[12.5px] leading-relaxed font-semibold text-brick ring-1 ring-brick/15">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      )}
    </AlertShell>
  );
}
