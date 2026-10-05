import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { GraduationCap, Info, Layers, Lock, Search, Users, X } from "lucide-react";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { useBodyScrollLock } from "../../../hooks/use-body-scroll-lock";
import { noneText } from "../../../lib/none-text";
import type { PublicTopic } from "../../../types/public.types";
import { personName } from "../../../lib/person-name";

type Summary = Pick<
  PublicTopic,
  "title" | "maxStudents" | "specialization" | "professor"
>;

type Person = { firstName?: string | null; lastName?: string | null } | null;
const nameOf = (u?: Person) =>
  personName(u);

/**
 * «هذا الموضوع محجوز» — لطالبٍ من غير الفريق الذي حجزه.
 *
 * ليس خطأً يُعتذر عنه، بل حالُ الموضوع: فلا أيقونة تحذيرٍ حمراء ولا «ممنوع».
 * ختمٌ ذهبيّ وسطرٌ يقول ما جرى، ثم ما يُفعل بعده — والخطوة التالية هي ما
 * يحتاجه الطالب لا الاعتذار: مواضيعُ متاحة، أو متاحُ المشرفِ نفسه إن كان
 * جاء من أجله.
 *
 * واللوحة واحدةٌ في موضعين: نافذةٌ فوق القائمة حين تُنقر البطاقة، وصفحةٌ
 * حين يصل الطالب بالرابط المباشر — وهناك لا ملخّص، فالخادم لا يُسلّم شيئاً
 * من تفاصيل المحجوز.
 */
export function ReservedTopicPanel({
  topic,
  titleId,
  onBrowseAvailable,
  onBrowseSupervisor,
  onClose,
  primaryRef,
}: {
  topic?: Summary | null;
  titleId?: string;
  onBrowseAvailable: () => void;
  /** يُعرض حين يُعرف المشرف: «مواضيع فلان المتاحة». */
  onBrowseSupervisor?: () => void;
  /** في النافذة وحدها: زرّ الإغلاق و«حسناً». */
  onClose?: () => void;
  primaryRef?: React.Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const prof = nameOf(topic?.professor?.user);

  return (
    <div
      data-testid="reserved-panel"
      className="overflow-hidden rounded-3xl border border-gold/25 bg-cream-card shadow-[0_30px_80px_-20px_rgba(10,20,18,0.55)]"
    >
      {/* ══ الرأس: الختم ══ */}
      <div className="relative bg-linear-to-br from-forest to-forest-deep px-6 pt-9 pb-8 text-center text-cream">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-gold/25 blur-3xl" />
          <div className="absolute inset-x-8 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("public.reservedDialog.close")}
            className="absolute end-4 top-4 grid size-9 place-items-center rounded-xl text-cream/60 transition hover:bg-white/10 hover:text-cream"
          >
            <X size={18} />
          </button>
        )}

        <div className="relative mx-auto grid size-24 place-items-center">
          <span className="animate-pulse-soft absolute inset-0 rounded-full bg-gold/20" />
          <span className="absolute inset-2 rounded-full border border-gold/40" />
          <span className="relative grid size-16 place-items-center rounded-full bg-linear-to-br from-gold-soft via-gold to-gold-soft/70 text-[var(--t-brand-deep)] shadow-[0_10px_30px_rgba(193,150,90,0.45)]">
            <Lock size={28} strokeWidth={2.2} />
          </span>
        </div>

        <p className="relative mt-5 text-[11px] font-semibold tracking-[0.18em] text-gold-soft">
          {t("public.reservedDialog.kicker")}
        </p>
        <h2
          id={titleId}
          className="relative mt-1.5 font-serif text-2xl leading-snug font-bold text-cream"
        >
          {t("public.reservedDialog.title")}
        </h2>
      </div>

      {/* ══ الجسم ══ */}
      <div className="space-y-4 p-6">
        {topic && (
          <div className="rounded-2xl border border-forest/10 bg-cream-2/70 p-4">
            <p className="line-clamp-2 font-serif text-base leading-snug font-bold break-words text-forest">
              {topic.title}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="shrink-0 rounded-full bg-linear-to-br from-gold-soft via-gold to-gold-soft/30 p-[2px]">
                <UserAvatar
                  user={topic.professor?.user}
                  size={34}
                  className="ring-2 ring-cream-card"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-forest">
                  {prof || noneText()}
                </span>
                <span className="block text-[11px] text-clay">
                  {t("public.supervisor")}
                </span>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topic.specialization?.name && (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-soft-sage/20 px-2.5 py-1 text-[11px] font-medium text-forest">
                  <Layers size={12} className="shrink-0 text-sage" />
                  <span className="truncate">{topic.specialization.name}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-soft-sage/20 px-2.5 py-1 text-[11px] font-medium text-forest">
                <Users size={12} className="shrink-0 text-sage" />
                {t("public.browse.seats", { count: topic.maxStudents })}
              </span>
            </div>
          </div>
        )}

        <p className="text-sm leading-relaxed text-forest/85">
          {t("public.reservedDialog.body")}
        </p>
        <p className="flex items-start gap-2 rounded-2xl bg-gold/8 px-4 py-3 text-xs leading-relaxed text-clay ring-1 ring-gold/20">
          <Info size={14} className="mt-0.5 shrink-0 text-gold" />
          {t("public.reservedDialog.note")}
        </p>

        <div className="space-y-2.5 pt-1">
          <button
            ref={primaryRef}
            type="button"
            onClick={onBrowseAvailable}
            data-testid="reserved-browse-available"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-l from-gold to-gold-soft py-3.5 text-sm font-bold text-[var(--t-brand-deep)] shadow-[0_10px_24px_rgba(193,150,90,0.35)] transition hover:brightness-105 active:scale-[0.98]"
          >
            <Search size={17} />
            {t("public.reservedDialog.browseAvailable")}
          </button>
          {onBrowseSupervisor && prof && (
            <button
              type="button"
              onClick={onBrowseSupervisor}
              data-testid="reserved-browse-supervisor"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-forest/15 py-3 text-sm font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/5 active:scale-[0.98]"
            >
              <GraduationCap size={16} className="text-gold" />
              {t("public.reservedDialog.bySupervisor", { name: prof })}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl py-2.5 text-sm font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              {t("public.reservedDialog.ok")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * النافذة: اللوحة فوق القائمة.
 *
 * `Escape` والنقر خارجها يغلقانها، والتركيز يبدأ على الخطوة التالية ويبقى
 * داخلها، ثم يعود عند الإغلاق إلى البطاقة التي فتحتها — فلا يضيع مكان من
 * يتصفّح بلوحة المفاتيح.
 */
export function ReservedTopicDialog({
  topic,
  onClose,
  onBrowseAvailable,
  onBrowseSupervisor,
}: {
  topic: Summary | null;
  onClose: () => void;
  onBrowseAvailable: () => void;
  onBrowseSupervisor?: () => void;
}) {
  const open = !!topic;
  useBodyScrollLock(open);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // الإغلاق يُقرأ من مرجع: دالّةٌ جديدة في كلّ رسمٍ للأب لا تُعيد الأثر،
  // فلا يقفز التركيز مع كلّ تحديثٍ للقائمة خلف النافذة.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll<HTMLElement>("button");
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus?.();
    };
  }, [open]);

  if (!topic) return null;

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 font-body">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 animate-[fadeIn_.25s_ease-out_both] bg-forest-deep/60 backdrop-blur-md"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="reserved-dialog"
        className="animate-scale-in relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl"
      >
        <ReservedTopicPanel
          topic={topic}
          titleId={titleId}
          primaryRef={primaryRef}
          onClose={onClose}
          onBrowseAvailable={onBrowseAvailable}
          onBrowseSupervisor={onBrowseSupervisor}
        />
      </div>
    </div>,
    document.body,
  );
}
