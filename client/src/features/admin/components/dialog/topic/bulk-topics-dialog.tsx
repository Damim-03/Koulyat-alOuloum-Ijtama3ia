import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  BellOff,
  BellRing,
  BookOpen,
  Check,
  ClipboardList,
  History,
  Info,
  PenLine,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AlertAction, AlertShell } from "../../../../../components/dialog/alert-shell";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import { CharCount } from "../../../../../components/ui/char-count";
import { REASON_MAX } from "../../../../../lib/limits";
import { personName } from "../../../../../lib/person-name";
import { blockReason, filterByAction } from "../../../lib/topic-actions";
import { statusChip } from "../../../utils/status-styles";
import type { AdminTopic } from "../../../../../types/admin";

export type BulkTopicMode = "delete" | "reject";

interface Props {
  mode: BulkTopicMode;
  /** التحديد كما هو عند الفتح؛ ويُفرز هنا إلى ما يقع عليه الإجراء وما يُستثنى. */
  topics: AdminTopic[];
  onClose: () => void;
  /** يُستدعى من الخطوة الثانية. والرفض يمرّر سببه، والسبب الفارغ لا يُرسَل. */
  onConfirm: (reason?: string) => void;
  busy: boolean;
  /** تقدّم التنفيذ موضوعاً بعد موضوع، ويُعرض على الزرّ ما دام جارياً. */
  progress?: { done: number; total: number };
}

/** عناوين الملخّص في خطوة التأكيد: ما زاد يُختصر في «+ن». */
const RECAP_MAX = 8;

const profName = (tp: AdminTopic) =>
  personName(tp.professor?.user) || tp.professor?.universityEmail || "—";

const MODE: Record<
  BulkTopicMode,
  { icon: LucideIcon; title: string; list: string; summary: string; kicker: string; confirm: string }
> = {
  delete: {
    icon: Trash2,
    title: "admin.deleteTopicsTitle",
    list: "admin.bulkTopics.deleteListTitle",
    summary: "admin.bulkTopics.deleteSummary",
    kicker: "admin.bulkTopics.deleteKicker",
    confirm: "admin.confirmDelete",
  },
  reject: {
    icon: XCircle,
    title: "admin.bulkRejectTitle",
    list: "admin.bulkTopics.rejectListTitle",
    summary: "admin.bulkTopics.rejectSummary",
    kicker: "admin.bulkTopics.rejectKicker",
    confirm: "admin.reject",
  },
};

/** عنوان قسم: أيقونةٌ في مربّع، والاسم، والعدد، وخيطٌ ذهبيّ يذوب نحو الطرف. */
function SectionTitle({
  icon: Icon,
  count,
  danger = false,
  children,
}: {
  icon: LucideIcon;
  count: number;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl ring-1 ${
          danger ? "bg-brick/12 text-brick ring-brick/25" : "bg-gold/12 text-gold ring-gold/25"
        }`}
      >
        <Icon size={15} />
      </span>
      <p className={`text-[13.5px] font-bold ${danger ? "text-brick" : "text-forest"}`}>{children}</p>
      <span
        dir="ltr"
        className={`rounded-full px-2.5 py-0.5 font-serif text-[12px] font-bold tabular-nums ring-1 ${
          danger ? "bg-brick/12 text-brick ring-brick/25" : "bg-gold/15 text-gold ring-gold/30"
        }`}
      >
        {count}
      </span>
      <span
        aria-hidden
        className={`h-px flex-1 bg-linear-to-r to-transparent rtl:bg-linear-to-l ${danger ? "from-brick/30" : "from-gold/35"}`}
      />
    </div>
  );
}

/**
 * الخطوتان بطاقتين متجاورتين: رقمٌ في وسام، واسم الخطوة، وما تحويه.
 * والرجوع إلى خطوةٍ مضت بالنقر عليها؛ والتقدّم من زرّ «التالي» وحده.
 */
function StepRail({
  steps,
  current,
  onGo,
  label,
}: {
  steps: { key: string; label: string; hint: string }[];
  current: number;
  onGo: (i: number) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <ol aria-label={label} data-testid="stepper" className="grid grid-cols-2 gap-2.5">
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={s.key} aria-current={active ? "step" : undefined} data-testid={`step-${s.key}`}>
            <button
              type="button"
              disabled={!done}
              onClick={() => onGo(i)}
              className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-start transition duration-300 disabled:cursor-default ${
                active
                  ? "border-gold/45 bg-linear-to-br from-gold/16 via-gold/6 to-transparent shadow-[0_14px_32px_-20px_rgba(193,150,90,0.95)]"
                  : done
                    ? "border-sage/30 bg-sage/8 hover:border-sage/55 hover:bg-sage/12"
                    : "border-forest/10 bg-cream-2/40"
              }`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl font-serif text-[17px] font-bold transition duration-300 ${
                  active
                    ? "bg-linear-to-br from-gold-soft to-gold text-forest-deep shadow-[0_8px_20px_-8px_rgba(193,150,90,0.9)] ring-1 ring-white/25"
                    : done
                      ? "bg-sage/20 text-sage ring-1 ring-sage/30"
                      : "bg-forest/5 text-clay ring-1 ring-forest/10"
                }`}
              >
                {done ? <Check size={18} strokeWidth={2.6} /> : <span dir="ltr">{i + 1}</span>}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold tracking-[0.14em] text-clay/75">
                  {t("admin.bulkTopics.stepN", { n: i + 1 })}
                </span>
                <span className={`block truncate text-[14px] font-bold ${active ? "text-forest" : "text-forest/70"}`}>
                  {s.label}
                </span>
                <span className="hidden truncate text-[11px] text-clay sm:block">{s.hint}</span>
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-linear-to-l from-transparent via-gold to-transparent"
                />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** حالة الموضوع: لونها، ونقطةٌ تسبق الاسم. */
function StatusPill({ status, className = "inline-flex" }: { status: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`${className} shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${statusChip(status)}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

/**
 * حذف المواضيع المحدَّدة أو رفضها — على خطوتين.
 *
 * كانت النافذة خطوةً واحدة: عددٌ وزرّ. ففي الحذف كانت قائمة المواضيع تأتي
 * بعد «سيُحذف معه»، فيُقرأ عنوانُ الموضوع كأنّه شيءٌ يسقط معه، وكانت فيها
 * أسطرٌ بلا معنى: «طلبات الفرق» عددها صفرٌ دائماً (الموضوع الذي ينتظره فريقٌ
 * لا يُحذف أصلاً)، و«طلبات الالتحاق» بلا عدد. وفي الرفض لم يكن يُرى ما
 * سيُرفض إطلاقاً: «سيُرفض 1 موضوعًا» وحقلُ سبب.
 *
 *   ١. **المراجعة:** ما سيقع عليه الإجراء بعنوانه وأستاذه وتخصّصه وحالته،
 *      وما حُدِّد ويستثنيه الخادم ولماذا. هنا يُكتشف الصفّ المحدَّد سهواً.
 *   ٢. **التأكيد:** ما سيحدث بالضبط. الحذف: ما يذهب معه، وأنّ الأستاذ لا
 *      يُبلَّغ، وأنّه نهائيّ. الرفض: سببٌ واحد، ومن يصله الإشعار بالاسم،
 *      وأنّ الموضوع يمكن قبوله بعدُ.
 *
 * الرجوع إلى المراجعة مسموح، فلا شيء يقع قبل زرّ الخطوة الثانية.
 *
 * تُركَّب النافذة عند الفتح وتُفكَّك عند الإغلاق، فخطوتها وسببها يبدآن
 * فارغين في كلّ مرّة. والتحديد يُثبَّت عند الفتح: حين ينتهي التنفيذ تُفرغ
 * الصفحة التحديد وتُعيد جلب الجدول والنافذة ما زالت مفتوحة، فلولا التثبيت
 * لفرغت القائمة في آخر لحظة.
 */
export function BulkTopicsDialog({ mode, topics, onClose, onConfirm, busy, progress }: Props) {
  const { t, i18n } = useTranslation();
  const [snapshot] = useState(topics);
  const ready = useMemo(() => filterByAction(snapshot, mode), [snapshot, mode]);
  const excluded = useMemo(() => snapshot.filter((tp) => !ready.includes(tp)), [snapshot, ready]);

  const [stepIndex, setStepIndex] = useState(0);
  const [reason, setReason] = useState("");
  const ghostRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const m = MODE[mode];
  const steps = [
    { key: "review", label: t("admin.bulkTopics.stepReview"), hint: t("admin.bulkTopics.stepReviewHint") },
    { key: "confirm", label: t("admin.bulkTopics.stepConfirm"), hint: t("admin.bulkTopics.stepConfirmHint") },
  ];
  const confirming = stepIndex === 1;
  const blocked = ready.length === 0;
  // «التالي» يشير إلى جهة القراءة: يساراً بالعربية، يميناً بغيرها.
  const rtl = i18n.dir() === "rtl";
  const Forward = rtl ? ArrowLeft : ArrowRight;
  const Backward = rtl ? ArrowRight : ArrowLeft;

  // التركيز يبدأ على الزرّ الهادئ (إلغاء، ثمّ السابق) لا على الفعل: Enter في
  // لحظة سهوٍ ينفّذ الزرّ المركَّز. وفي تأكيد الرفض ينتقل إلى حقل السبب.
  useEffect(() => {
    if (confirming && mode === "reject") reasonRef.current?.focus?.();
    else ghostRef.current?.focus?.();
  }, [confirming, mode]);

  /** أساتذة المواضيع المرفوضة، كلٌّ بعدد مواضيعه — وهم من يصلهم الإشعار. */
  const professors = useMemo(() => {
    const byId = new Map<string, { key: string; user: unknown; name: string; count: number }>();
    for (const tp of ready) {
      const key = tp.professor?.id ?? tp.professorId ?? tp.id;
      const seen = byId.get(key);
      if (seen) seen.count++;
      else byId.set(key, { key, user: tp.professor?.user, name: profName(tp), count: 1 });
    }
    return [...byId.values()];
  }, [ready]);

  const confirmLabel =
    busy && progress && progress.total > 0
      ? t("admin.bulkProgress", progress)
      : `${t(m.confirm)} (${ready.length})`;

  return (
    <AlertShell
      open
      tone="danger"
      icon={m.icon}
      kicker={blocked ? t("alert.kickerBlocked") : t("alert.kickerDanger")}
      title={t(m.title)}
      onClose={onClose}
      busy={busy}
      size="lg"
      actions={
        confirming ? (
          <>
            <AlertAction ref={ghostRef} variant="ghost" icon={Backward} onClick={() => setStepIndex(0)} disabled={busy}>
              {t("admin.back")}
            </AlertAction>
            <AlertAction
              tone="danger"
              icon={m.icon}
              loading={busy}
              onClick={() => onConfirm(mode === "reject" ? reason.trim() || undefined : undefined)}
              testid="bulk-confirm"
            >
              {confirmLabel}
            </AlertAction>
          </>
        ) : (
          <>
            <AlertAction ref={ghostRef} variant="ghost" onClick={onClose}>
              {t("admin.cancel")}
            </AlertAction>
            <AlertAction
              tone="warning"
              icon={Forward}
              onClick={() => setStepIndex(1)}
              disabled={blocked}
              testid="bulk-next"
            >
              {t("admin.next")}
            </AlertAction>
          </>
        )
      }
    >
      <div className="mb-6">
        <StepRail steps={steps} current={stepIndex} onGo={(i) => !busy && setStepIndex(i)} label={t(m.title)} />
      </div>

      {!confirming ? (
        /* ══ الخطوة ١ — المراجعة ══ */
        <div key="review" data-testid="bulk-step-review" className="animate-slide-up">
          <SectionTitle icon={ClipboardList} count={ready.length}>
            {t(m.list)}
          </SectionTitle>

          {blocked ? (
            <div className="flex items-start gap-3 rounded-2xl border border-brick/30 bg-linear-to-br from-brick/12 to-brick/4 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brick/15 text-brick ring-1 ring-brick/25">
                <Ban size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-brick">
                  {t(mode === "delete" ? "admin.blockNothingDeletable" : "admin.bulkTopics.nothingRejectable")}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-clay">{t("admin.bulkTopics.nothingHint")}</p>
              </div>
            </div>
          ) : (
            <ol data-testid="bulk-ready" className="space-y-2 p-0.5 sm:max-h-72 sm:overflow-y-auto">
              {ready.map((tp, i) => (
                <li
                  key={tp.id}
                  className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-forest/10 bg-linear-to-l from-cream-2/90 to-cream-2/40 py-3 ps-4 pe-3.5 transition duration-300 hover:border-gold/35 hover:shadow-[0_14px_30px_-22px_rgba(193,150,90,0.9)]"
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-3 start-0 w-0.75 rounded-e-full bg-linear-to-b from-gold to-gold/15 opacity-70 transition group-hover:opacity-100"
                  />
                  <span
                    dir="ltr"
                    className="w-7 shrink-0 text-center font-serif text-[21px] leading-none font-bold text-gold/75 tabular-nums"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-serif text-[15px] leading-snug font-bold text-forest" title={tp.title}>
                      {tp.title}
                    </p>
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-forest/6 py-0.5 ps-0.5 pe-2.5 text-[11.5px] font-medium text-forest/80 ring-1 ring-forest/8">
                        <UserAvatar user={tp.professor?.user} size={18} />
                        <span className="truncate">{profName(tp)}</span>
                      </span>
                      {tp.specialization?.name && (
                        <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-forest/6 px-2.5 py-0.5 text-[11.5px] text-clay ring-1 ring-forest/8">
                          <BookOpen size={11} className="shrink-0" />
                          <span className="truncate">{tp.specialization.name}</span>
                        </span>
                      )}
                      {/* على الهاتف تنزل الحالة إلى هذا السطر، فيتّسع العنوان. */}
                      <StatusPill status={tp.status} className="inline-flex sm:hidden" />
                    </div>
                  </div>
                  <StatusPill status={tp.status} className="hidden sm:inline-flex" />
                </li>
              ))}
            </ol>
          )}

          {/* المستثنى وسببه: هو الفرق بين ما حُدِّد وما سيقع. */}
          {excluded.length > 0 && (
            <div className="mt-6">
              <SectionTitle icon={Ban} count={excluded.length} danger>
                {t("admin.bulkTopics.excludedTitle")}
              </SectionTitle>
              <p className="-mt-1 mb-2.5 text-[11.5px] leading-relaxed text-clay">{t("admin.bulkTopics.excludedLead")}</p>
              <ul data-testid="bulk-excluded" className="space-y-2 p-0.5 sm:max-h-44 sm:overflow-y-auto">
                {excluded.map((tp) => {
                  const why = blockReason(tp, mode, t);
                  return (
                    <li
                      key={tp.id}
                      className="flex items-start gap-3 rounded-2xl border border-brick/20 bg-linear-to-l from-brick/9 to-brick/3 px-3.5 py-2.5"
                    >
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brick/12 text-brick">
                        <Ban size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] leading-snug font-bold text-forest/90" title={tp.title}>
                          {tp.title}
                        </p>
                        {why && <p className="mt-0.5 text-[11.5px] leading-relaxed text-brick/90">{why}</p>}
                      </div>
                      <StatusPill status={tp.status} className="hidden sm:inline-flex" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* ══ الخطوة ٢ — التأكيد ══ */
        <div key="confirm" data-testid="bulk-step-confirm" className="animate-slide-up space-y-4">
          {/* الملخّص: العدد في وسامٍ بلون الفعل، والجملة، والعناوين مختصرة. */}
          <div className="relative overflow-hidden rounded-3xl border border-brick/25 bg-linear-to-br from-brick/14 via-brick/5 to-transparent p-5 shadow-[0_20px_44px_-30px_rgba(168,68,45,0.9)]">
            <div
              aria-hidden
              className="dot-matrix pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
            />
            <div aria-hidden className="absolute -end-10 -top-10 size-36 rounded-full bg-brick/10 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="relative grid size-17 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-[#d66a4f] to-[#8c301d] text-white shadow-[0_16px_32px_-12px_rgba(168,68,45,0.85)] ring-1 ring-white/20">
                <span dir="ltr" className="font-serif text-[28px] leading-none font-bold tabular-nums">
                  {ready.length}
                </span>
                <span className="absolute -end-1.5 -bottom-1.5 grid size-7 place-items-center rounded-lg bg-cream-card text-brick shadow-md ring-1 ring-brick/25">
                  <m.icon size={14} />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold tracking-[0.16em] text-brick">{t(m.kicker)}</p>
                <p className="mt-1 font-serif text-[19px] leading-snug font-bold text-forest">
                  {t(m.summary, { count: ready.length })}
                </p>
                {excluded.length > 0 && (
                  <p className="mt-1 text-[12px] text-clay">
                    {t("admin.bulkTopics.excludedNote", { count: excluded.length })}
                  </p>
                )}
              </div>
            </div>
            <ul className="relative mt-4 flex flex-wrap gap-1.5 border-t border-brick/15 pt-3.5">
              {ready.slice(0, RECAP_MAX).map((tp) => (
                <li
                  key={tp.id}
                  title={tp.title}
                  className="max-w-56 truncate rounded-lg bg-cream-card/80 px-2.5 py-1 text-[11.5px] font-semibold text-forest shadow-sm ring-1 ring-brick/15"
                >
                  {tp.title}
                </li>
              ))}
              {ready.length > RECAP_MAX && (
                <li dir="ltr" className="rounded-lg bg-brick/10 px-2.5 py-1 font-serif text-[11.5px] font-bold text-brick">
                  +{ready.length - RECAP_MAX}
                </li>
              )}
            </ul>
          </div>

          {mode === "delete" ? (
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {[
                { icon: History, text: t("admin.bulkTopics.deleteGoesWith") },
                { icon: BellOff, text: t("admin.bulkTopics.deleteNoNotice") },
              ].map((row) => (
                <li
                  key={row.text}
                  className="flex items-start gap-3 rounded-2xl border border-forest/10 bg-cream-2/50 p-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-forest/6 text-clay ring-1 ring-forest/10">
                    <row.icon size={16} />
                  </span>
                  <p className="pt-0.5 text-[12.5px] leading-relaxed text-forest/85">{row.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <label className="block rounded-2xl border border-forest/10 bg-cream-2/50 p-4 transition focus-within:border-gold/45 focus-within:shadow-[0_14px_30px_-22px_rgba(193,150,90,0.9)]">
                <span className="mb-2.5 flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold ring-1 ring-gold/25">
                    <PenLine size={15} />
                  </span>
                  <span className="text-[13.5px] font-bold text-forest">{t("admin.bulkTopics.reasonLabel")}</span>
                  <span className="text-[11px] text-clay">{t("admin.bulkTopics.optional")}</span>
                </span>
                <textarea
                  ref={reasonRef}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={REASON_MAX}
                  rows={3}
                  disabled={busy}
                  placeholder={t("admin.rejectReasonPlaceholder")}
                  className="w-full resize-none rounded-xl border border-forest/12 bg-cream-card px-3.5 py-3 text-sm leading-relaxed text-forest outline-none transition placeholder:text-clay/60 focus:border-gold focus:ring-4 focus:ring-gold/15 disabled:opacity-60"
                />
                <CharCount value={reason} max={REASON_MAX} className="mt-1.5" />
              </label>

              <div>
                <p className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-clay">
                  <BellRing size={14} className="text-gold" />
                  {t("admin.bulkTopics.notifiedTitle")}
                </p>
                <ul data-testid="bulk-professors" className="flex flex-wrap gap-2">
                  {professors.map((p) => (
                    <li
                      key={p.key}
                      className="flex max-w-full items-center gap-2.5 rounded-2xl border border-forest/10 bg-cream-2/60 py-1.5 ps-1.5 pe-3.5 shadow-[0_8px_20px_-16px_rgba(38,66,61,0.6)]"
                    >
                      <UserAvatar user={p.user} size={30} radius="rounded-xl" />
                      <span className="truncate text-[12.5px] font-bold text-forest">{p.name}</span>
                      {p.count > 1 && (
                        <span
                          dir="ltr"
                          className="rounded-full bg-gold/15 px-2 py-px font-serif text-[11px] font-bold text-gold ring-1 ring-gold/25"
                        >
                          ×{p.count}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {mode === "delete" ? (
            <p className="flex items-center gap-2.5 rounded-2xl bg-linear-to-l from-brick/12 to-brick/4 px-4 py-3 text-[12.5px] leading-relaxed font-bold text-brick ring-1 ring-brick/20">
              <AlertTriangle size={16} className="shrink-0" />
              {t("admin.irreversibleWarning")}
            </p>
          ) : (
            <p className="flex items-center gap-2.5 rounded-2xl bg-linear-to-l from-sage/12 to-sage/4 px-4 py-3 text-[12px] leading-relaxed text-forest/85 ring-1 ring-sage/25">
              <Info size={16} className="shrink-0 text-sage" />
              {t("admin.bulkTopics.rejectReversible")}
            </p>
          )}
        </div>
      )}
    </AlertShell>
  );
}
