import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, FileStack, Loader2, Minus, Pencil, Plus, Users, X, type LucideIcon } from "lucide-react";
import type { TopicQuotaState } from "../../../../../types/admin";
import { useClearTopicQuota, useSetTopicQuota, useTopicQuota } from "../../../hooks/admin-hook";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import { UserAvatar } from "../../../../../components/ui/user-avatar";

const MIN = 1;
const MAX = 50;
const QUICK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * حدّ المواضيع لكلّ أستاذ في السنة — بجانب فترتَي الاقتراح والاختيار وعدد
 * الطلبة، في إعدادات المواضيع: الحدّ (أو أنّه لا حدّ)، وكم أستاذاً اقترح، ومن
 * بلغه ومن تجاوزه. ومنها يُحدَّد ويُغيَّر ويُلغى.
 *
 * والحسبة حسبة الخادم (core/academic/topic-quota): كلّ موضوعٍ للأستاذ في
 * السنة إلّا المرفوض؛ والإدارة لا تتقيّد به.
 */
export function TopicQuotaCard({ yearId }: { yearId?: string }) {
  const { t } = useTranslation();
  const { data } = useTopicQuota(yearId);
  const [editing, setEditing] = useState(false);

  if (!yearId) return null;
  if (!data) return <div className="mb-6 h-[88px] animate-pulse rounded-2xl bg-forest/5" aria-hidden />;

  const { year, stats } = data;
  const max = year.maxTopicsPerProfessor;
  return (
    <section
      aria-labelledby="topic-quota-title"
      data-testid="topic-quota-card"
      className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-forest/10 bg-cream-card px-5 py-4 shadow-sm"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
        <FileStack size={21} />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="topic-quota-title" className="font-serif text-[15px] font-bold text-forest">
            {t("admin.topicQuota.title")}
          </h2>
          <span className="text-xs text-clay">{year.title}</span>
          <span
            data-testid="topic-quota-state"
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              max === null ? "bg-gray-100 text-gray-600 dark:bg-gray-400/15 dark:text-gray-300" : "bg-gold/15 text-gold"
            }`}
          >
            {max === null ? t("admin.topicQuota.none") : t("admin.topicQuota.perProfessor", { count: max })}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-clay">{max === null ? t("admin.topicQuota.unsetHint") : t("admin.topicQuota.setHint")}</p>
      </div>

      <dl className="flex flex-wrap items-stretch gap-2">
        <Stat icon={Users} label={t("admin.topicQuota.statProposing")} value={t("admin.topicQuota.ofTotal", { n: stats.proposing, total: stats.professors })} />
        {max !== null && <Stat icon={CheckCircle2} label={t("admin.topicQuota.statAtLimit")} value={String(stats.atLimit)} />}
        {max !== null && <Stat icon={AlertTriangle} label={t("admin.topicQuota.statOver")} value={String(stats.over)} warn={stats.over > 0} />}
      </dl>

      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={!!year.archivedAt}
        title={year.archivedAt ? t("admin.topicQuota.archived") : undefined}
        data-testid="topic-quota-edit"
        className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {max === null ? <Plus size={16} /> : <Pencil size={16} />}
        {max === null ? t("admin.topicQuota.set") : t("admin.topicQuota.edit")}
      </button>

      {editing && <TopicQuotaDialog state={data} onClose={() => setEditing(false)} />}
    </section>
  );
}

function Stat({ icon: Icon, label, value, warn = false }: { icon: LucideIcon; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`min-w-[7.5rem] rounded-xl px-3 py-2 ring-1 ${warn ? "bg-amber-500/8 ring-amber-500/25" : "bg-cream-2/70 ring-forest/8"}`}>
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold text-clay">
        <Icon size={12} className={warn ? "text-amber-600 dark:text-amber-300" : "text-gold"} />
        {label}
      </dt>
      <dd className="mt-0.5 font-serif text-lg leading-tight font-bold text-forest tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * الحدّ: رقمٌ يُختار — من الأرقام الشائعة أو بالزيادة والنقص حتى خمسين —،
 * وبجانبه أثره قبل أن يُحفظ: كم أستاذاً لكلّ عدد، ومن يبلغه ومن يتجاوزه
 * بأسمائهم. ومن تجاوزه تبقى مواضيعه، ولا يرسل جديداً.
 */
function TopicQuotaDialog({ state, onClose }: { state: TopicQuotaState; onClose: () => void }) {
  const { t } = useTranslation();
  useBodyScrollLock(true);
  const { year, histogram, professors } = state;
  const [n, setN] = useState(year.maxTopicsPerProfessor ?? 3);
  const save = useSetTopicQuota();
  const clear = useClearTopicQuota();
  const busy = save.isPending || clear.isPending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const counts = Object.entries(histogram)
    .map(([c, p]) => [Number(c), p] as const)
    .sort((a, b) => a[0] - b[0]);
  const atLimit = histogram[String(n)] ?? 0;
  const over = counts.filter(([c]) => c > n).reduce((s, [, p]) => s + p, 0);
  const affected = professors.filter((p) => p.count >= n);
  const tallest = Math.max(1, ...counts.map(([, p]) => p));
  const step = (d: number) => setN((v) => Math.min(MAX, Math.max(MIN, v + d)));

  return createPortal(
    <div className="fixed inset-0 z-60 grid place-items-center overflow-y-auto p-3 font-body sm:p-5" role="dialog" aria-modal="true" aria-labelledby="topic-quota-dialog-title">
      <div onClick={() => !busy && onClose()} className="fixed inset-0 bg-forest-deep/60 backdrop-blur-md" />

      <div className="animate-scale-in relative my-auto w-full max-w-[980px] overflow-hidden rounded-[26px] border border-gold/20 bg-cream-card shadow-[0_40px_120px_-30px_rgba(10,20,17,0.75)]">
        <header className="forest-glow relative flex items-center gap-4 px-6 py-5 text-cream sm:px-8">
          <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
          <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold-soft ring-1 ring-gold/30">
            <FileStack size={21} />
          </span>
          <div className="relative min-w-0 flex-1">
            <h3 id="topic-quota-dialog-title" className="font-serif text-[20px] font-bold">
              {t("admin.topicQuota.dialogTitle", { year: year.title })}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-cream/70">{t("admin.topicQuota.dialogHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("admin.topicQuota.close")}
            className="relative grid size-9 shrink-0 place-items-center self-start rounded-xl text-cream/75 transition hover:bg-white/10 hover:text-cream disabled:opacity-40"
          >
            <X size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-linear-to-l from-gold via-gold-soft to-gold" />
        </header>

        <div className="grid max-h-[72vh] gap-6 overflow-y-auto px-6 py-6 sm:px-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* ═══ 1 · the limit ═══ */}
          <section aria-labelledby="topic-quota-number" className="min-w-0 space-y-4">
            <SectionTitle id="topic-quota-number" n={1} text={t("admin.topicQuota.sectionNumber")} />
            <div className="rounded-2xl border border-gold/25 bg-linear-to-b from-gold/8 to-transparent p-5 text-center">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={n <= MIN}
                  aria-label={t("admin.topicQuota.less")}
                  data-testid="topic-quota-less"
                  className="grid size-10 place-items-center rounded-xl bg-cream-2 text-forest ring-1 ring-forest/15 transition hover:ring-gold disabled:opacity-40"
                >
                  <Minus size={17} />
                </button>
                <output
                  data-testid="topic-quota-value"
                  aria-live="polite"
                  className="min-w-20 font-serif text-6xl leading-none font-bold text-forest tabular-nums"
                >
                  {n}
                </output>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={n >= MAX}
                  aria-label={t("admin.topicQuota.more")}
                  data-testid="topic-quota-more"
                  className="grid size-10 place-items-center rounded-xl bg-cream-2 text-forest ring-1 ring-forest/15 transition hover:ring-gold disabled:opacity-40"
                >
                  <Plus size={17} />
                </button>
              </div>
              <p className="mt-2 text-[12px] font-semibold text-clay">{t("admin.topicQuota.perProfessorLong", { count: n })}</p>
            </div>
            <div role="radiogroup" aria-label={t("admin.topicQuota.sectionNumber")} className="grid grid-cols-5 gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  role="radio"
                  aria-checked={n === q}
                  aria-label={t("admin.topicQuota.perProfessor", { count: q })}
                  onClick={() => setN(q)}
                  className={`h-10 rounded-xl font-serif text-base font-bold tabular-nums transition ${
                    n === q
                      ? "bg-linear-to-br from-gold to-gold-soft text-[#1a312d] shadow-[0_8px_18px_-10px_rgba(193,150,90,0.9)]"
                      : "bg-cream-2 text-forest ring-1 ring-forest/15 hover:ring-gold"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] leading-relaxed text-clay">{t("admin.topicQuota.countsHint")}</p>
          </section>

          {/* ═══ 2 · what it means for the professors ═══ */}
          <section aria-labelledby="topic-quota-effect" aria-live="polite" data-testid="topic-quota-impact" className="min-w-0 space-y-4">
            <SectionTitle id="topic-quota-effect" n={2} text={t("admin.topicQuota.sectionImpact")} />
            <div className="grid grid-cols-3 gap-2">
              <Figure label={t("admin.topicQuota.statProposing")} value={state.stats.proposing} />
              <Figure label={t("admin.topicQuota.statAtLimit")} value={atLimit} testId="topic-quota-impact-at" />
              <Figure label={t("admin.topicQuota.statOver")} value={over} warn={over > 0} testId="topic-quota-impact-over" />
            </div>

            {/* How many professors have each count — the limit drawn across it. */}
            {counts.length > 0 && (
              <div className="rounded-2xl border border-forest/10 bg-cream-2/50 p-4" data-testid="topic-quota-histogram">
                <p className="mb-3 text-[11.5px] font-semibold text-clay">{t("admin.topicQuota.histogram")}</p>
                <div className="flex h-28 items-end gap-2">
                  {counts.map(([c, p]) => (
                    <div key={c} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <span className="text-[10.5px] font-bold text-forest tabular-nums">{p}</span>
                      <div
                        className={`w-full max-w-10 rounded-t-lg transition-all duration-300 ${
                          c > n ? "bg-amber-500/70" : c === n ? "bg-gold" : "bg-forest/20"
                        }`}
                        style={{ height: `${Math.max(8, (p / tallest) * 72)}px` }}
                      />
                      <span className="text-[10.5px] text-clay tabular-nums">{c}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-center text-[10.5px] text-clay/80">{t("admin.topicQuota.histogramAxis")}</p>
              </div>
            )}

            {over > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800 dark:text-amber-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {t("admin.topicQuota.overHint")}
              </p>
            )}

            {affected.length > 0 ? (
              <ul className="max-h-60 divide-y divide-forest/8 overflow-y-auto rounded-2xl border border-forest/10" data-testid="topic-quota-professors">
                {affected.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <UserAvatar user={p.avatar ?? {}} size={30} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-forest">{p.name || "—"}</span>
                    <span className="text-[12px] text-clay tabular-nums">{t("admin.topicQuota.topics", { count: p.count })}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                        p.count > n ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-gold/15 text-gold"
                      }`}
                    >
                      {p.count > n ? t("admin.topicQuota.overChip") : t("admin.topicQuota.atChip")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-500/8 px-3 py-2.5 text-[12px] text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={15} />
                {t("admin.topicQuota.nobody")}
              </p>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/50 px-6 py-4 sm:px-8">
          {year.maxTopicsPerProfessor !== null ? (
            <button
              type="button"
              onClick={() => clear.mutate(year.id, { onSuccess: onClose })}
              disabled={busy}
              data-testid="topic-quota-clear"
              className="text-sm font-semibold text-red-600 transition hover:underline disabled:opacity-50 dark:text-red-300"
            >
              {t("admin.topicQuota.clear")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-50"
            >
              {t("admin.topicQuota.cancel")}
            </button>
            <button
              type="button"
              onClick={() => save.mutate({ yearId: year.id, max: n }, { onSuccess: onClose })}
              disabled={busy}
              data-testid="topic-quota-save"
              className="inline-flex items-center gap-2 rounded-xl bg-linear-to-br from-gold to-gold-soft px-6 py-2.5 text-sm font-bold text-[#1a312d] shadow-[0_10px_24px_-10px_rgba(193,150,90,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {save.isPending && <Loader2 size={16} className="animate-spin" />}
              {t("admin.topicQuota.save")}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function SectionTitle({ id, n, text }: { id: string; n: number; text: string }) {
  return (
    <h4 id={id} className="flex items-center gap-2.5 text-[13px] font-bold text-forest">
      <span className="grid size-6 place-items-center rounded-full bg-gold/15 font-serif text-[12px] text-gold">{n}</span>
      {text}
    </h4>
  );
}

function Figure({ label, value, warn = false, testId }: { label: string; value: number; warn?: boolean; testId?: string }) {
  return (
    <div data-testid={testId} className={`rounded-xl px-3 py-2.5 ring-1 ${warn ? "bg-amber-500/8 ring-amber-500/25" : "bg-cream-2/70 ring-forest/8"}`}>
      <p className="truncate text-[10.5px] font-semibold text-clay">{label}</p>
      <p className={`mt-0.5 font-serif text-xl leading-tight font-bold tabular-nums ${warn ? "text-amber-700 dark:text-amber-300" : "text-forest"}`}>{value}</p>
    </div>
  );
}
