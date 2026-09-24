import { useTranslation } from "react-i18next";
import { CloudOff, RotateCcw } from "lucide-react";

/**
 * تعذّرَ الجلب — ومعه زرُّ إعادة المحاولة.
 *
 * وسببُ وجودها أنّ الشاشات كانت تعرض «لا يوجد طلاب» حين ينقطع الاتّصال:
 * الجلبُ يفشل، و`isLoading` يصير `false`، فيصدق شرطُ `length === 0` — لأنّ
 * القائمة لم تصل لا لأنّها فارغة. فيقرأ المسؤول أنّ القاعدة خالية وهي عامرة.
 *
 * ولغتُها لغةُ من يقرؤها لا لغةُ من كتبها: «تعذّر جلب البيانات» جملةٌ
 * دقيقةٌ للمبرمج وغامضةٌ لموظّف القسم — لا تقول ما الذي حدث ولا ما يفعله.
 * فصارت تقول ثلاثة أشياء بترتيبها: **ما جرى** (البيانات لم تصل)، **وما لم
 * يجرِ** (لم يُحذف شيء — وهو أوّل ما يخطر لمن رأى قائمته فارغة)، **وما
 * يفعله** (زرٌّ واحد ظاهر).
 *
 * وزرُّ الإعادة يستدعي `refetch` لهذا الاستعلام وحده: لا تُفقد حالةُ الشاشة
 * — المرشِّحات والصفحة والبحث — ولا يُعاد تحميل ما لم يفشل.
 */
export function ErrorRetry({
  onRetry,
  title,
  hint,
  compact = false,
  className,
}: {
  onRetry: () => void;
  /** عنوانٌ يخصّ الشاشة، وإلّا فالعامّ. */
  title?: string;
  hint?: string;
  /** صيغةٌ مختصرة لصفّ جدول: سطرٌ واحد بلا تلميح. */
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  const retry = (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft active:scale-95"
    >
      <RotateCcw size={15} />
      {t("admin.retry")}
    </button>
  );

  if (compact)
    return (
      <div
        className={`my-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-brick/20 bg-brick/6 px-4 py-3 ${className ?? ""}`}
        role="alert"
      >
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brick/12 text-brick">
            <CloudOff size={16} />
          </span>
          <span className="text-sm font-bold text-forest">
            {title ?? t("admin.loadError")}
          </span>
        </span>
        {retry}
      </div>
    );

  return (
    <div
      className={`grid place-items-center gap-4 rounded-2xl border border-brick/20 bg-brick/5 px-6 py-10 text-center ${className ?? ""}`}
      role="alert"
    >
      {/* هالةٌ حول الأيقونة: تُلطّف الإنذار ولا تُلغيه. */}
      <span className="grid size-16 place-items-center rounded-full bg-brick/12 text-brick ring-8 ring-brick/5">
        <CloudOff size={28} />
      </span>

      <div className="max-w-sm">
        <p className="font-serif text-base font-bold text-forest">
          {title ?? t("admin.loadError")}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-clay">
          {hint ?? t("admin.loadFailedHint")}
        </p>
      </div>

      {retry}
    </div>
  );
}
