import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, Check, Crown, GraduationCap, Lock, PencilLine, ShieldCheck, Users } from "lucide-react";

/** One line of the review: its value as it will be saved, and what it was if that changes. */
export interface ReviewLine {
  key: string;
  label: string;
  after: string;
  before?: string;
  changed: boolean;
}

/**
 * المرحلة الأخيرة من تعديل موضوع: المراجعة والتأكيد.
 *
 * ما تغيّر أوّلاً — كلّ حقلٍ بقيمته السابقة ثمّ الجديدة — فيُرى أثرُ الحفظ قبل
 * الحفظ؛ ثمّ الموضوع كما سيُحفظ كاملاً: محتواه، وإسناده، وطلبته (أو أنّهم لا
 * يُمسّون في تعديل الموضوع وحده). ولكلّ بطاقةٍ رجوعٌ إلى مرحلتها.
 */
export function TopicReviewStep({
  topic,
  placement,
  students,
  untouchedStudents,
  onEdit,
}: {
  topic: ReviewLine[];
  placement: ReviewLine[];
  /** The team as it will be saved — or, when the students are not edited here, nothing. */
  students?: { id: string; name: string; reg: string; leader: boolean; added: boolean }[];
  /** Editing the topic alone: its students stay as they are. */
  untouchedStudents?: boolean;
  onEdit: (step: "topic" | "students") => void;
}) {
  const { t } = useTranslation();
  const changes = [...topic, ...placement].filter((l) => l.changed);
  const studentsChanged = !!students?.some((s) => s.added);
  const count = changes.length + (studentsChanged ? 1 : 0);

  return (
    <div className="space-y-5" data-testid="topic-review">
      {/* What saving will do. */}
      <section className="relative overflow-hidden rounded-3xl border border-gold/30 bg-linear-to-bl from-gold/12 via-cream to-cream p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold text-forest-deep shadow-[0_8px_20px_-10px_rgba(193,150,90,0.9)]">
            <ShieldCheck size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-lg font-bold text-forest">{t("admin.topicReview.title")}</h3>
            <p className="text-[12px] text-clay">{t("admin.topicReview.hint")}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[12px] font-bold ${count ? "bg-gold/20 text-gold" : "bg-forest/8 text-clay"}`}
            data-testid="topic-review-count"
          >
            {count ? t("admin.topicReview.changes", { count }) : t("admin.topicReview.noChanges")}
          </span>
        </div>

        {changes.length > 0 && (
          <ul className="mt-4 space-y-1.5" data-testid="topic-review-changes">
            {changes.map((l) => (
              <li key={l.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl bg-cream-card/80 px-3 py-2 text-[12.5px] ring-1 ring-forest/8">
                <span className="shrink-0 font-semibold text-forest">{l.label}</span>
                <span className="min-w-0 truncate text-clay line-through decoration-clay/50" dir="auto">
                  {l.before || "—"}
                </span>
                <ArrowLeft size={13} className="shrink-0 text-gold ltr:rotate-180" />
                <span className="min-w-0 truncate font-bold text-forest" dir="auto">
                  {l.after || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card icon={BookOpen} title={t("admin.topicReview.topicCard")} onEdit={() => onEdit("topic")}>
          <Lines lines={topic} />
        </Card>
        <Card icon={GraduationCap} title={t("admin.topicReview.placement")} onEdit={() => onEdit("topic")}>
          <Lines lines={placement} />
        </Card>
      </div>

      <Card icon={Users} title={t("admin.topicReview.students")} onEdit={students ? () => onEdit("students") : undefined}>
        {untouchedStudents ? (
          <p className="flex items-center gap-2 text-[12.5px] text-clay" data-testid="topic-review-untouched">
            <Lock size={14} className="shrink-0 text-forest/40" />
            {t("admin.topicReview.untouched")}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(students ?? []).map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-xl bg-cream px-3 py-2 ring-1 ring-forest/8">
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${s.leader ? "bg-gold text-forest-deep" : "bg-forest/6 text-forest/60"}`}>
                  {s.leader ? <Crown size={13} /> : <Check size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-forest">{s.name}</span>
                  <span className="block text-[11px] text-clay tabular-nums" dir="ltr">
                    {s.reg}
                  </span>
                </span>
                {s.leader && <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10.5px] font-bold text-gold">{t("admin.topicReview.leader")}</span>}
                {s.added && <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">{t("admin.topicReview.added")}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({ icon: Icon, title, onEdit, children }: { icon: typeof BookOpen; title: string; onEdit?: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_8px_24px_-18px_rgba(38,66,61,0.35)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold text-forest">
          <Icon size={16} className="text-gold" />
          {title}
        </h4>
        {onEdit && (
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-forest/70 transition hover:bg-forest/5 hover:text-forest">
            <PencilLine size={12} />
            {t("admin.editStep")}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Lines({ lines }: { lines: ReviewLine[] }) {
  return (
    <dl className="space-y-2 text-[12.5px]">
      {lines.map((l) => (
        <div key={l.key} className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-clay">{l.label}</dt>
          <dd className={`min-w-0 text-end break-words ${l.changed ? "font-bold text-gold" : "font-medium text-forest"}`} dir="auto">
            {l.after || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
